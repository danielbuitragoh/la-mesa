-- =====================================================================
-- LA MESA · Correcciones de seguridad y permisos
-- Se ejecuta DESPUÉS de schema.sql y seed.sql, una sola vez.
--
-- Arregla los seis puntos que impiden que un pedido real llegue de la
-- app al panel. Sin esto el esquema compila pero el flujo no funciona.
-- Es idempotente: se puede volver a correr sin romper nada.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1 · El perfil se crea solo al registrarse
--
-- pedidos.usuario_id apunta a perfiles(id) y es NOT NULL, pero nada
-- creaba la fila. Sin esto, el primer pedido de cualquier usuario nuevo
-- falla por clave foránea.
-- ---------------------------------------------------------------------
create or replace function crear_perfil_al_registrarse() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into perfiles (id, nombre, email)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1),
      'Cliente'
    ),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_crear_perfil on auth.users;
create trigger trg_crear_perfil
  after insert on auth.users
  for each row execute function crear_perfil_al_registrarse();

-- Y para los usuarios que ya existan sin perfil (los creados a mano
-- antes de este parche):
insert into perfiles (id, nombre, email)
select u.id, coalesce(split_part(u.email, '@', 1), 'Cliente'), u.email
  from auth.users u
  left join perfiles p on p.id = u.id
 where p.id is null;


-- ---------------------------------------------------------------------
-- 2 · Los triggers de negocio escriben en tablas con RLS
--
-- acreditar_puntos() inserta en puntos_movimientos y registrar_evento()
-- en pedido_eventos, pero corren con los permisos de quien dispara el
-- UPDATE. Cuando cocina marca un pedido como entregado, el insert lo
-- rechaza RLS y se cae el cambio de estado entero.
--
-- Se redeclaran idénticos pero con security definer.
-- ---------------------------------------------------------------------
create or replace function acreditar_puntos() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ganados integer;
begin
  if new.estado = 'entregado' and old.estado is distinct from 'entregado' then
    ganados := floor(new.total / 1000)::integer;

    update perfiles
       set puntos = puntos + ganados,
           puntos_historicos = puntos_historicos + ganados
     where id = new.usuario_id;

    insert into puntos_movimientos (usuario_id, pedido_id, tipo, puntos, descripcion)
    values (new.usuario_id, new.id, 'ganados', ganados, 'Pedido #' || new.numero);

    new.puntos_ganados := ganados;
    new.entregado_en   := now();
  end if;
  return new;
end;
$$;

create or replace function registrar_evento() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.estado is distinct from old.estado then
    insert into pedido_eventos (pedido_id, estado) values (new.id, new.estado);
  end if;
  return new;
end;
$$;


-- ---------------------------------------------------------------------
-- 3 · Políticas que faltaban
-- ---------------------------------------------------------------------

-- El cliente necesita poder crear su propio perfil si el trigger no
-- llegó a tiempo (y actualizarlo, que ya estaba).
drop policy if exists "crear su perfil" on perfiles;
create policy "crear su perfil"
  on perfiles for insert with check (id = auth.uid());

-- Las líneas del pedido: sin esto el pedido se crea vacío.
drop policy if exists "crear items de sus pedidos" on pedido_items;
create policy "crear items de sus pedidos"
  on pedido_items for insert
  with check (exists (select 1 from pedidos p
                       where p.id = pedido_id
                         and (p.usuario_id = auth.uid() or es_staff())));

-- El menú lo escribe el staff desde el panel. El comentario del esquema
-- decía "service role", pero el panel usa el token del usuario que entra,
-- así que sin estas políticas el CRUD del menú no funciona.
drop policy if exists "staff edita categorias" on categorias;
create policy "staff edita categorias"
  on categorias for all using (es_staff()) with check (es_staff());

drop policy if exists "staff edita productos" on productos;
create policy "staff edita productos"
  on productos for all using (es_staff()) with check (es_staff());


-- ---------------------------------------------------------------------
-- 4 · Las seis tablas que se quedaron sin RLS
--
-- En Supabase, una tabla del esquema public sin RLS queda expuesta a
-- lectura Y ESCRITURA por cualquiera con la clave anónima, que va
-- dentro de la app y se puede leer. grupos_opcion y opciones además
-- las consulta la app en el select anidado del menú.
-- ---------------------------------------------------------------------
alter table sede_horarios   enable row level security;
alter table producto_sede   enable row level security;
alter table grupos_opcion   enable row level security;
alter table opciones        enable row level security;
alter table cupones_usados  enable row level security;
alter table pedido_eventos  enable row level security;

-- Lectura pública: es información del menú, no hay nada que proteger.
drop policy if exists "horarios publicos" on sede_horarios;
create policy "horarios publicos" on sede_horarios for select using (true);

drop policy if exists "disponibilidad publica" on producto_sede;
create policy "disponibilidad publica" on producto_sede for select using (true);

drop policy if exists "grupos publicos" on grupos_opcion;
create policy "grupos publicos" on grupos_opcion for select using (true);

drop policy if exists "opciones publicas" on opciones;
create policy "opciones publicas" on opciones for select using (true);

-- Escritura solo staff.
drop policy if exists "staff edita grupos" on grupos_opcion;
create policy "staff edita grupos"
  on grupos_opcion for all using (es_staff()) with check (es_staff());

drop policy if exists "staff edita opciones" on opciones;
create policy "staff edita opciones"
  on opciones for all using (es_staff()) with check (es_staff());

drop policy if exists "staff edita horarios" on sede_horarios;
create policy "staff edita horarios"
  on sede_horarios for all using (es_staff()) with check (es_staff());

drop policy if exists "staff edita disponibilidad" on producto_sede;
create policy "staff edita disponibilidad"
  on producto_sede for all using (es_staff()) with check (es_staff());

-- Privadas de cada quien.
drop policy if exists "sus cupones usados" on cupones_usados;
create policy "sus cupones usados"
  on cupones_usados for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "eventos de sus pedidos" on pedido_eventos;
create policy "eventos de sus pedidos"
  on pedido_eventos for select
  using (exists (select 1 from pedidos p
                  where p.id = pedido_id
                    and (p.usuario_id = auth.uid() or es_staff())));


-- ---------------------------------------------------------------------
-- 5 · Verificación
--
-- La primera consulta debe devolver CERO filas. Si devuelve alguna,
-- esa tabla está abierta al público y hay que taparla.
-- ---------------------------------------------------------------------
select tablename as "TABLA SIN RLS"
  from pg_tables
 where schemaname = 'public'
   and rowsecurity = false;

-- Y esta enseña cuántas políticas quedó teniendo cada tabla.
select tablename as tabla, count(*) as politicas
  from pg_policies
 where schemaname = 'public'
 group by tablename
 order by tablename;

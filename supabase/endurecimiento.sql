-- =====================================================================
-- LA MESA · Endurecimiento (noviembre de 2026)
-- Se corre DESPUÉS de cuenta-demo.sql. Es idempotente.
--
-- Tres agujeros que el esquema compilaba sin avisar, y la limpieza que
-- pedía el linter de Supabase:
--
--   1. Cualquier cuenta podía cambiarse el rol. `perfiles` dejaba editar
--      la fila propia entera, así que la cuenta demo de cocina —cuya
--      contraseña es pública— podía ponerse `es_demo = false` y pasar a
--      mover pedidos. Lo mismo con `rol` y con `puntos`.
--   2. El total del pedido lo escribía el teléfono. La función de cobro
--      lo "volvía a leer de la base", pero la base guardaba lo que la app
--      le había mandado: una hamburguesa a $1 se firmaba por $1.
--   3. Se podían añadir platos a un pedido propio en cualquier momento,
--      también después de pagado o entregado.
--
-- Ninguno cambia lo que hace la app publicada: manda lo mismo que antes
-- y la base, en vez de creérselo, lo calcula.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0 · Funciones de permisos fuera de la API
--
-- es_staff() y es_staff_editor() son SECURITY DEFINER y vivían en
-- `public`, que PostgREST publica entero: cualquiera podía llamarlas por
-- /rpc. No filtraban nada grave, pero una función con privilegios no
-- tiene por qué estar en el escaparate. Se mudan a un esquema que la API
-- no expone; las políticas las siguen encontrando.
-- ---------------------------------------------------------------------
create schema if not exists privado;
grant usage on schema privado to authenticated, service_role;

do $$
begin
  if to_regprocedure('public.es_staff()') is not null then
    if to_regprocedure('privado.es_staff()') is not null then
      drop function privado.es_staff();
    end if;
    alter function public.es_staff() set schema privado;
  end if;
  if to_regprocedure('public.es_staff_editor()') is not null then
    if to_regprocedure('privado.es_staff_editor()') is not null then
      drop function privado.es_staff_editor();
    end if;
    alter function public.es_staff_editor() set schema privado;
  end if;
end $$;

create or replace function privado.es_staff() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from perfiles
     where id = auth.uid() and rol in ('cocina','caja','admin')
  );
$$;

create or replace function privado.es_staff_editor() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from perfiles
     where id = auth.uid()
       and rol in ('cocina','caja','admin')
       and es_demo = false
  );
$$;

-- ¿La petición viene de la app o del panel (con el token de una persona),
-- o del servidor (llave de servicio, editor SQL, migraciones)? Lo que
-- sigue solo desconfía de lo primero.
create or replace function privado.viene_de_la_app() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(auth.role(), '') in ('authenticated', 'anon');
$$;

revoke all on function privado.es_staff(), privado.es_staff_editor(), privado.viene_de_la_app() from public, anon;
grant execute on function privado.es_staff(), privado.es_staff_editor(), privado.viene_de_la_app() to authenticated, service_role;

-- Ya estaba aplicado en producción y faltaba en el repositorio.
alter function public.generar_codigo_mesa() set search_path = public, pg_temp;
alter function public.nivel_de(integer)     set search_path = pg_temp;


-- ---------------------------------------------------------------------
-- 1 · Qué columnas puede escribir una persona
--
-- La seguridad por fila decide QUÉ FILAS; no dice nada de las columnas.
-- Eso va con permisos de columna: del perfil propio se puede cambiar el
-- nombre, el teléfono, la foto, las preferencias y el token de avisos.
-- El rol, los puntos y la marca de cuenta demo solo los toca el servidor.
-- ---------------------------------------------------------------------
revoke insert, update on public.perfiles from anon, authenticated;
grant insert (id, nombre, telefono, email, avatar_url, acepta_promos, push_token)
  on public.perfiles to authenticated;
grant update (nombre, telefono, avatar_url, acepta_promos, push_token)
  on public.perfiles to authenticated;

-- Del pedido, la app decide qué se pide y cómo se entrega. El número, las
-- marcas de tiempo, los puntos y la referencia de pago no son suyos.
revoke insert on public.pedidos from anon, authenticated;
grant insert (usuario_id, sede_id, mesa_id, modalidad, estado, direccion_id,
              direccion_texto, notas, programado_para, subtotal, descuento,
              costo_domicilio, propina, total, cupon_id, metodo_pago, estado_pago)
  on public.pedidos to authenticated;

-- Nadie sin sesión escribe en ninguna tabla, y vaciar una tabla entera
-- (TRUNCATE se salta la seguridad por fila) no es cosa de la API.
revoke insert, update, delete on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;


-- ---------------------------------------------------------------------
-- 2 · El precio lo pone la carta, no el teléfono
-- ---------------------------------------------------------------------

-- 2a · Al nacer, un pedido no vale nada: todavía no tiene platos.
create or replace function public.sanear_pedido() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  sede record;
begin
  if not privado.viene_de_la_app() then return new; end if;

  select moneda, costo_domicilio into sede
    from sedes where id = new.sede_id and activa;
  if not found then
    raise exception 'Esa sede no existe o no está recibiendo pedidos.' using errcode = 'P0001';
  end if;

  -- El cobro de esta demo es simulado (ver README): el pedido puede nacer
  -- ya en `recibido` para que llegue a cocina. Con una pasarela real, aquí
  -- se fuerza `pendiente_pago` salvo en efectivo, y solo el webhook lo mueve.
  if new.estado not in ('pendiente_pago', 'recibido') then
    new.estado := 'pendiente_pago';
  end if;
  if new.estado_pago not in ('pendiente', 'aprobado') then
    new.estado_pago := 'pendiente';
  end if;

  new.moneda          := sede.moneda;
  new.subtotal        := 0;
  new.descuento       := 0;
  new.costo_domicilio := case when new.modalidad = 'domicilio' then sede.costo_domicilio else 0 end;
  new.propina         := greatest(0, least(coalesce(new.propina, 0), 200000));
  new.total           := new.costo_domicilio + new.propina;
  new.confirmado_en   := case when new.estado = 'recibido' then now() end;
  return new;
end;
$$;

drop trigger if exists trg_sanear_pedido on public.pedidos;
create trigger trg_sanear_pedido
  before insert on public.pedidos
  for each row execute function public.sanear_pedido();

-- 2b · Cada plato entra con el nombre y el precio de la carta. Las
--      opciones que no existan para ese plato se descartan: no pueden
--      llegar a cocina como si alguien las hubiera pagado.
create or replace function public.poner_precio_de_carta() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  pedido  record;
  plato   record;
  pedida  jsonb;
  opcion  record;
  extra   numeric := 0;
  validas jsonb   := '[]'::jsonb;
begin
  if not privado.viene_de_la_app() then return new; end if;

  select usuario_id, sede_id, estado, creado_en into pedido
    from pedidos where id = new.pedido_id;
  if not found then
    raise exception 'Ese pedido no existe.' using errcode = 'P0001';
  end if;

  -- Quien pide solo completa su pedido recién creado. El equipo sí puede
  -- añadir platos después (alguien pide una bebida más en la barra).
  if not privado.es_staff_editor() then
    if pedido.usuario_id is distinct from auth.uid()
       or pedido.estado not in ('pendiente_pago', 'recibido')
       or pedido.creado_en < now() - interval '10 minutes' then
      raise exception 'Este pedido ya no admite cambios.' using errcode = 'P0001';
    end if;
    new.usuario_id := auth.uid();
  end if;

  select p.nombre,
         coalesce(ps.precio, p.precio)                    as precio,
         p.disponible and coalesce(ps.disponible, true)   as disponible
    into plato
    from productos p
    left join producto_sede ps on ps.producto_id = p.id and ps.sede_id = pedido.sede_id
   where p.id = new.producto_id;
  if not found then
    raise exception 'Ese plato no está en la carta.' using errcode = 'P0001';
  end if;
  if not plato.disponible then
    raise exception 'Se acabó: %.', plato.nombre using errcode = 'P0001';
  end if;
  if new.cantidad > 50 then
    raise exception 'Para pedidos tan grandes, llama al restaurante.' using errcode = 'P0001';
  end if;

  for pedida in
    select * from jsonb_array_elements(
      case when jsonb_typeof(new.opciones) = 'array' then new.opciones else '[]'::jsonb end)
  loop
    select g.nombre as grupo, o.nombre as nombre, o.precio_extra into opcion
      from grupos_opcion g
      join opciones o on o.grupo_id = g.id
     where g.producto_id = new.producto_id
       and g.nombre = pedida ->> 'grupo'
       and o.nombre = pedida ->> 'opcion'
       and o.disponible
     limit 1;

    if found and not validas @> jsonb_build_array(
         jsonb_build_object('grupo', opcion.grupo, 'opcion', opcion.nombre)) then
      extra   := extra + opcion.precio_extra;
      validas := validas || jsonb_build_object(
                   'grupo', opcion.grupo, 'opcion', opcion.nombre,
                   'precio_extra', opcion.precio_extra);
    end if;
  end loop;

  new.nombre      := plato.nombre;
  new.opciones    := validas;
  new.precio_unit := plato.precio + extra;
  new.total_linea := new.precio_unit * new.cantidad;
  return new;
end;
$$;

drop trigger if exists trg_poner_precio_de_carta on public.pedido_items;
create trigger trg_poner_precio_de_carta
  before insert on public.pedido_items
  for each row execute function public.poner_precio_de_carta();

-- 2c · Con los platos dentro, el pedido se suma en la base. El cupón se
--      comprueba aquí —vigencia, mínimo, usos— y si no vale, no descuenta.
--      Es la misma cuenta que hace el carrito de la app, para que lo que
--      la persona vio antes de pagar sea lo que se le cobra.
create or replace function privado.recalcular_pedido(p_pedido uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  pedido     pedidos%rowtype;
  cupon      cupones%rowtype;
  envio_sede numeric;
  v_subtotal numeric := 0;
  v_descuento numeric := 0;
  v_envio    numeric := 0;
  cupon_vale boolean := false;
begin
  select * into pedido from pedidos where id = p_pedido for update;
  if not found then return; end if;

  select costo_domicilio into envio_sede from sedes where id = pedido.sede_id;
  select coalesce(sum(total_linea), 0) into v_subtotal
    from pedido_items where pedido_id = p_pedido;

  if pedido.cupon_id is not null then
    select * into cupon from cupones where id = pedido.cupon_id;
    cupon_vale := found
      and cupon.activo
      and cupon.inicia_en <= now()
      and (cupon.vence_en is null or cupon.vence_en > now())
      and v_subtotal >= cupon.monto_minimo
      and (cupon.usos_max is null or cupon.usos_actuales < cupon.usos_max)
      and (select count(*) from cupones_usados u
            where u.cupon_id = cupon.id
              and u.usuario_id = pedido.usuario_id
              and u.pedido_id is distinct from pedido.id) < cupon.usos_por_usuario;
  end if;

  if cupon_vale then
    if cupon.tipo = 'porcentaje' then
      v_descuento := round(v_subtotal * cupon.valor / 100);
    elsif cupon.tipo = 'monto_fijo' then
      v_descuento := least(v_subtotal, cupon.valor);
    elsif cupon.tipo = 'dos_por_uno' then
      -- De cada par, el más barato sale gratis; solo cuentan los platos
      -- de la categoría del cupón, si tiene una.
      select coalesce(sum(precio), 0) into v_descuento
        from (
          select i.precio_unit as precio,
                 row_number() over (order by i.precio_unit, i.id, n) as puesto,
                 count(*) over ()                                    as cuantos
            from pedido_items i
            join productos p on p.id = i.producto_id
           cross join lateral generate_series(1, i.cantidad) as n
           where i.pedido_id = p_pedido
             and (cupon.categoria_id is null or p.categoria_id = cupon.categoria_id)
        ) unidades
       where puesto % 2 = 1 and puesto < cuantos;
    end if;
  end if;

  if pedido.modalidad = 'domicilio'
     and not (cupon_vale and cupon.tipo = 'envio_gratis') then
    v_envio := coalesce(envio_sede, 0);
  end if;

  update pedidos
     set subtotal        = v_subtotal,
         descuento       = v_descuento,
         costo_domicilio = v_envio,
         total           = greatest(0, v_subtotal - v_descuento + v_envio) + propina,
         cupon_id        = case when cupon_vale then cupon_id end
   where id = p_pedido;
end;
$$;

create or replace function public.recalcular_tras_items() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  fila record;
begin
  for fila in select distinct pedido_id from nuevos loop
    perform privado.recalcular_pedido(fila.pedido_id);
  end loop;
  return null;
end;
$$;

drop trigger if exists trg_recalcular_tras_items on public.pedido_items;
create trigger trg_recalcular_tras_items
  after insert on public.pedido_items
  referencing new table as nuevos
  for each statement execute function public.recalcular_tras_items();

-- 2d · El límite de pedidos es para la app, no para el servidor: sembrar
--      datos o importar pedidos desde el editor SQL no tiene que esperar
--      un minuto entre fila y fila.
create or replace function public.limitar_pedidos() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  ultimo  timestamptz;
  en_hora int;
begin
  if not privado.viene_de_la_app() then return new; end if;

  -- Serializa los pedidos de una misma cuenta: dos inserts simultáneos
  -- no pueden colarse los dos por el mismo hueco.
  perform pg_advisory_xact_lock(hashtext(new.usuario_id::text));

  select max(creado_en), count(*)
    into ultimo, en_hora
    from pedidos
   where usuario_id = new.usuario_id
     and creado_en > now() - interval '1 hour';

  if ultimo is not null and ultimo > now() - interval '60 seconds' then
    raise exception 'Espera un minuto antes de hacer otro pedido.' using errcode = 'P0001';
  end if;
  if en_hora >= 5 then
    raise exception 'Llegaste al limite de 5 pedidos por hora. Si necesitas mas, llama al restaurante.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Son disparadores: nadie tiene por qué poder llamarlos a mano.
revoke all on function public.sanear_pedido(), public.poner_precio_de_carta(),
                       public.recalcular_tras_items(), public.limitar_pedidos(),
                       public.acreditar_puntos(), public.registrar_evento(),
                       public.crear_perfil_al_registrarse()
  from public, anon, authenticated;
revoke all on function privado.recalcular_pedido(uuid) from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 3 · Las políticas, reescritas
--
-- Mismas reglas, tres cambios de forma:
--   · `(select auth.uid())` en vez de `auth.uid()`: Postgres lo evalúa
--     una vez por consulta y no una por fila.
--   · `to authenticated`: sin sesión ni se evalúan.
--   · Las de "el equipo edita" eran FOR ALL y se sumaban a la lectura
--     pública en cada SELECT; ahora son una por operación.
-- ---------------------------------------------------------------------
drop policy if exists "cada quien ve su perfil"    on public.perfiles;
drop policy if exists "cada quien edita su perfil" on public.perfiles;
drop policy if exists "crear su perfil"            on public.perfiles;
create policy "cada quien ve su perfil" on public.perfiles
  for select to authenticated
  using (id = (select auth.uid()) or (select privado.es_staff()));
create policy "crear su perfil" on public.perfiles
  for insert to authenticated
  with check (id = (select auth.uid()));
create policy "cada quien edita su perfil" on public.perfiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists "sus direcciones" on public.direcciones;
create policy "sus direcciones" on public.direcciones
  for all to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));

drop policy if exists "sus pedidos"           on public.pedidos;
drop policy if exists "crear pedidos propios" on public.pedidos;
drop policy if exists "staff mueve estados"   on public.pedidos;
create policy "sus pedidos" on public.pedidos
  for select to authenticated
  using (usuario_id = (select auth.uid()) or (select privado.es_staff()));
create policy "crear pedidos propios" on public.pedidos
  for insert to authenticated
  with check (usuario_id = (select auth.uid()));
create policy "staff mueve estados" on public.pedidos
  for update to authenticated
  using ((select privado.es_staff_editor())) with check ((select privado.es_staff_editor()));

drop policy if exists "items de sus pedidos"       on public.pedido_items;
drop policy if exists "crear items de sus pedidos" on public.pedido_items;
create policy "items de sus pedidos" on public.pedido_items
  for select to authenticated
  using (exists (select 1 from pedidos p
                  where p.id = pedido_id
                    and (p.usuario_id = (select auth.uid()) or (select privado.es_staff()))));
create policy "crear items de sus pedidos" on public.pedido_items
  for insert to authenticated
  with check (exists (select 1 from pedidos p
                       where p.id = pedido_id
                         and (p.usuario_id = (select auth.uid()) or (select privado.es_staff_editor()))));

drop policy if exists "eventos de sus pedidos" on public.pedido_eventos;
create policy "eventos de sus pedidos" on public.pedido_eventos
  for select to authenticated
  using (exists (select 1 from pedidos p
                  where p.id = pedido_id
                    and (p.usuario_id = (select auth.uid()) or (select privado.es_staff()))));

drop policy if exists "sus momentos" on public.momentos;
create policy "sus momentos" on public.momentos
  for all to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));

drop policy if exists "sus puntos" on public.puntos_movimientos;
create policy "sus puntos" on public.puntos_movimientos
  for select to authenticated
  using (usuario_id = (select auth.uid()) or (select privado.es_staff()));

drop policy if exists "mesas donde participa" on public.mesas;
create policy "mesas donde participa" on public.mesas
  for select to authenticated
  using (anfitrion_id = (select auth.uid())
      or exists (select 1 from mesa_participantes mp
                  where mp.mesa_id = id and mp.usuario_id = (select auth.uid()))
      or (select privado.es_staff()));

drop policy if exists "participantes de sus mesas" on public.mesa_participantes;
create policy "participantes de sus mesas" on public.mesa_participantes
  for all to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));

drop policy if exists "sus favoritos" on public.favoritos;
create policy "sus favoritos" on public.favoritos
  for all to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));

drop policy if exists "sus cupones usados" on public.cupones_usados;
create policy "sus cupones usados" on public.cupones_usados
  for all to authenticated
  using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));

-- El equipo edita la carta: una política por operación y por tabla.
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('categorias',    'categorias'),
      ('productos',     'productos'),
      ('grupos_opcion', 'grupos'),
      ('opciones',      'opciones'),
      ('sede_horarios', 'horarios'),
      ('producto_sede', 'disponibilidad')
    ) as v(tabla, apodo)
  loop
    execute format('drop policy if exists %I on public.%I', 'staff edita ' || t.apodo, t.tabla);
    execute format('drop policy if exists %I on public.%I', 'staff crea '  || t.apodo, t.tabla);
    execute format('drop policy if exists %I on public.%I', 'staff cambia ' || t.apodo, t.tabla);
    execute format('drop policy if exists %I on public.%I', 'staff borra ' || t.apodo, t.tabla);

    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check ((select privado.es_staff_editor()))',
      'staff crea ' || t.apodo, t.tabla);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using ((select privado.es_staff_editor())) with check ((select privado.es_staff_editor()))',
      'staff cambia ' || t.apodo, t.tabla);
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using ((select privado.es_staff_editor()))',
      'staff borra ' || t.apodo, t.tabla);
  end loop;
end $$;


-- ---------------------------------------------------------------------
-- 4 · Índices para las claves foráneas
--
-- Postgres indexa la clave primaria, no la columna que apunta a ella.
-- Sin estos, borrar un plato o una persona recorre entera cada tabla
-- que los menciona, y las políticas de arriba hacen lo mismo en cada
-- consulta.
-- ---------------------------------------------------------------------
create index if not exists idx_cupones_categoria        on public.cupones(categoria_id);
create index if not exists idx_cupones_usados_cupon     on public.cupones_usados(cupon_id);
create index if not exists idx_cupones_usados_usuario   on public.cupones_usados(usuario_id);
create index if not exists idx_direcciones_usuario      on public.direcciones(usuario_id);
create index if not exists idx_favoritos_producto       on public.favoritos(producto_id);
create index if not exists idx_grupos_producto          on public.grupos_opcion(producto_id);
create index if not exists idx_participantes_usuario    on public.mesa_participantes(usuario_id);
create index if not exists idx_mesas_anfitrion          on public.mesas(anfitrion_id);
create index if not exists idx_mesas_pedido             on public.mesas(pedido_id);
create index if not exists idx_mesas_sede               on public.mesas(sede_id);
create index if not exists idx_momentos_pedido          on public.momentos(pedido_id);
create index if not exists idx_momentos_usuario         on public.momentos(usuario_id);
create index if not exists idx_opciones_grupo           on public.opciones(grupo_id);
create index if not exists idx_eventos_actor            on public.pedido_eventos(actor_id);
create index if not exists idx_items_producto           on public.pedido_items(producto_id);
create index if not exists idx_items_usuario            on public.pedido_items(usuario_id);
create index if not exists idx_pedidos_cupon            on public.pedidos(cupon_id);
create index if not exists idx_pedidos_direccion        on public.pedidos(direccion_id);
create index if not exists idx_pedidos_mesa             on public.pedidos(mesa_id);
create index if not exists idx_perfiles_sede            on public.perfiles(sede_id);
create index if not exists idx_producto_sede_sede       on public.producto_sede(sede_id);
create index if not exists idx_puntos_pedido            on public.puntos_movimientos(pedido_id);
create index if not exists idx_puntos_recompensa        on public.puntos_movimientos(recompensa_id);
create index if not exists idx_recompensas_producto     on public.recompensas(producto_id);
create index if not exists idx_horarios_sede            on public.sede_horarios(sede_id);

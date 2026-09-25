-- =====================================================================
-- Cuenta demo de solo lectura + límite de pedidos
-- ---------------------------------------------------------------------
-- Se corre DESPUÉS de schema.sql, seed.sql y correcciones.sql.
--
-- El panel de cocina se enseña en el portafolio con una cuenta pública
-- (panel-admin.html?demo). Esa cuenta tiene que VER todo lo que ve cocina
-- pero no poder cambiar nada, y la garantía tiene que estar en la base:
-- cualquiera con las credenciales puede llamar a la API sin pasar por el
-- panel. Y como también hay credenciales públicas de cliente, crear
-- pedidos lleva un límite por cuenta.
-- =====================================================================

-- 1. Marca de cuenta demo -------------------------------------------------
alter table public.perfiles
  add column if not exists es_demo boolean not null default false;

-- Igual que es_staff(), pero excluye las cuentas demo. Las políticas de
-- LECTURA siguen usando es_staff(); las de ESCRITURA pasan a esta.
create or replace function public.es_staff_editor()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from perfiles
     where id = auth.uid()
       and rol in ('cocina','caja','admin')
       and es_demo = false
  );
$$;

-- 2. Escrituras del equipo ----------------------------------------------
drop policy if exists "staff mueve estados" on public.pedidos;
create policy "staff mueve estados" on public.pedidos
  for update using (es_staff_editor());

drop policy if exists "crear items de sus pedidos" on public.pedido_items;
create policy "crear items de sus pedidos" on public.pedido_items
  for insert with check (
    exists (
      select 1 from pedidos p
       where p.id = pedido_items.pedido_id
         and (p.usuario_id = auth.uid() or es_staff_editor())
    )
  );

-- Menú y horarios: cada tabla ya tiene su SELECT público (using true),
-- así que la lectura no depende de estas políticas.
alter policy "staff edita categorias"     on public.categorias    using (es_staff_editor()) with check (es_staff_editor());
alter policy "staff edita grupos"         on public.grupos_opcion using (es_staff_editor()) with check (es_staff_editor());
alter policy "staff edita opciones"       on public.opciones      using (es_staff_editor()) with check (es_staff_editor());
alter policy "staff edita disponibilidad" on public.producto_sede using (es_staff_editor()) with check (es_staff_editor());
alter policy "staff edita productos"      on public.productos     using (es_staff_editor()) with check (es_staff_editor());
alter policy "staff edita horarios"       on public.sede_horarios using (es_staff_editor()) with check (es_staff_editor());

-- 3. Límite de pedidos: 1 por minuto y 5 por hora, por cuenta --------------
create or replace function public.limitar_pedidos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ultimo  timestamptz;
  en_hora int;
begin
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

drop trigger if exists trg_limitar_pedidos on public.pedidos;
create trigger trg_limitar_pedidos
  before insert on public.pedidos
  for each row execute function public.limitar_pedidos();

-- 4. La cuenta demo -------------------------------------------------------
-- Crear el usuario en Authentication → Users (cocina@lamesa.co, con Auto
-- Confirm) y después:
update public.perfiles
   set rol = 'cocina',
       es_demo = true,
       sede_id = '11111111-1111-1111-1111-111111111111',
       nombre  = 'Cocina · El Poblado (demo solo lectura)'
 where email = 'cocina@lamesa.co';

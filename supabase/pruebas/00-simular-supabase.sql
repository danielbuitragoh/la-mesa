-- =====================================================================
-- LA MESA · Un Supabase de mentira para probar en un PostgreSQL normal
--
-- Supabase trae hechos los roles `anon` y `authenticated`, el esquema
-- `auth` y la publicación de tiempo real. Aquí se crea lo mínimo para
-- que schema.sql y las políticas corran igual en una base vacía, sin
-- credenciales y sin tocar el proyecto real.
-- =====================================================================
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon')          then create role anon nologin;          end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role')  then create role service_role nologin bypassrls; end if;
end $$;

create schema auth;

create table auth.users (
  id                 uuid primary key,
  email              text unique,
  raw_user_meta_data jsonb not null default '{}'
);

-- Igual que en Supabase: quién llama viaja en el JWT de la petición.
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid;
$$;

create function auth.role() returns text language sql stable as $$
  select current_setting('request.jwt.claims', true)::jsonb ->> 'role';
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;

create publication supabase_realtime;

-- Supabase da todos los permisos de tabla a estos roles y deja que la
-- seguridad por fila decida. Se replica tal cual: es justo el punto de
-- partida que el endurecimiento tiene que cerrar.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

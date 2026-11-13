-- =====================================================================
-- LA MESA · Pruebas de seguridad de la base
--
-- Cada prueba entra como lo haría la API —con el rol y el JWT de una
-- persona— e intenta algo. No se prueba la interfaz: quien tenga la
-- clave pública puede llamar a la API sin pasar por la app.
--
-- Se corre con supabase/pruebas/probar.sh sobre una base vacía.
-- =====================================================================
\set ON_ERROR_STOP on
\set QUIET on
\pset format unaligned
\pset tuples_only on
set client_min_messages = warning;

-- ---------- utilería ----------
create schema prueba;
create table prueba.resultados (n serial, ok boolean, que text);

create function prueba.anotar(p_ok boolean, p_que text) returns void
language plpgsql security definer as $$
begin
  insert into prueba.resultados (ok, que) values (p_ok, p_que);
  if not p_ok then raise warning 'FALLA · %', p_que; end if;
end $$;

-- La consulta tiene que devolver exactamente este valor.
create function prueba.da(p_sql text, p_esperado text, p_que text) returns void
language plpgsql as $$
declare v text;
begin
  begin
    execute p_sql into v;
  exception when others then
    perform prueba.anotar(false, p_que || ' (error: ' || sqlerrm || ')');
    return;
  end;
  perform prueba.anotar(v is not distinct from p_esperado,
    p_que || case when v is distinct from p_esperado
                  then ' (esperaba ' || coalesce(p_esperado, 'null') || ', salió ' || coalesce(v, 'null') || ')'
                  else '' end);
end $$;

-- La sentencia tiene que ser rechazada con un error.
create function prueba.rechaza(p_sql text, p_que text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    perform prueba.anotar(true, p_que);
    return;
  end;
  perform prueba.anotar(false, p_que || ' (se aceptó)');
end $$;

-- La sentencia no da error, pero no puede tocar ninguna fila.
create function prueba.no_toca(p_sql text, p_que text) returns void
language plpgsql as $$
declare n bigint;
begin
  begin
    execute p_sql;
    get diagnostics n = row_count;
  exception when others then
    perform prueba.anotar(true, p_que);
    return;
  end;
  perform prueba.anotar(n = 0, p_que || case when n <> 0 then ' (tocó ' || n || ' filas)' else '' end);
end $$;

-- Lo que hace falta para seguir probando después de un pedido: el límite
-- de un pedido por minuto se aparta moviendo el reloj del pedido anterior.
create function prueba.envejecer(p_usuario uuid) returns void
language sql security definer as $$
  update public.pedidos set creado_en = creado_en - interval '3 hours' where usuario_id = p_usuario;
$$;

grant usage on schema prueba to anon, authenticated;
grant execute on all functions in schema prueba to anon, authenticated;

-- ---------- personas ----------
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ana@ejemplo.co'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'beto@ejemplo.co'),
  ('cccccccc-0000-0000-0000-000000000003', 'cocina-real@lamesa.co'),
  ('dddddddd-0000-0000-0000-000000000004', 'cocina@lamesa.co');

update public.perfiles set rol = 'cocina' where email = 'cocina-real@lamesa.co';
update public.perfiles set rol = 'cocina', es_demo = true where email = 'cocina@lamesa.co';

\set ana    '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}'
\set beto   '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}'
\set cocina '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}'
\set demo   '{"sub":"dddddddd-0000-0000-0000-000000000004","role":"authenticated"}'
\set nadie  '{"role":"anon"}'

-- Atajos para no repetir los uuid de la carta
create view prueba.carta as
  select (select id from public.productos where nombre = 'La Clásica de la Casa')  as clasica,
         (select id from public.productos where nombre = 'Doble Mandarina')        as doble,
         (select id from public.productos where nombre = 'Bowl Ensalada La Mesa')  as bowl,
         (select id from public.productos where nombre = 'Café del Poblado')       as cafe,
         (select id from public.cupones   where codigo = '2X1MESA')                as dos_por_uno,
         (select id from public.cupones   where codigo = 'PRIMERA20')              as veinte,
         (select id from public.cupones   where tipo = 'envio_gratis')             as envio_gratis,
         '11111111-1111-1111-1111-111111111111'::uuid                              as sede;
grant select on prueba.carta to anon, authenticated;


-- =====================================================================
-- SIN SESIÓN
-- =====================================================================
set role anon;
select set_config('request.jwt.claims', :'nadie', false) \gset ignorar_

select prueba.da('select count(*) from productos', '10', 'sin sesión se lee la carta');
select prueba.da('select count(*) from opciones',  '7',  'sin sesión se leen las opciones de los platos');
select prueba.da('select count(*) from perfiles',  '0',  'sin sesión no se ve ningún perfil');
select prueba.da('select count(*) from pedidos',   '0',  'sin sesión no se ve ningún pedido');
select prueba.rechaza(
  $$insert into pedidos (usuario_id, sede_id, modalidad)
    values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'recoger')$$,
  'sin sesión no se crea un pedido a nombre de otro');
select prueba.rechaza($$update productos set precio = 1$$, 'sin sesión no se cambia un precio');
select prueba.rechaza($$select privado.es_staff()$$, 'las funciones de permisos no se llaman sin sesión');


-- =====================================================================
-- ANA, CLIENTA · el precio lo pone la carta
-- =====================================================================
set role authenticated;
select set_config('request.jwt.claims', :'ana', false) \gset ignorar_

-- Pide dos hamburguesas a $1 y dice que ya pagó $2.
insert into pedidos (usuario_id, sede_id, modalidad, estado, estado_pago, metodo_pago, subtotal, total)
select 'aaaaaaaa-0000-0000-0000-000000000001', sede, 'recoger', 'recibido', 'aprobado', 'nequi', 2, 2
  from prueba.carta;

select prueba.da('select total::int::text from pedidos', '0',
  'un pedido recién creado no guarda el total que mandó la app');

insert into pedido_items (pedido_id, producto_id, nombre, precio_unit, cantidad, opciones, total_linea)
select p.id, c.clasica, 'Hamburguesa regalada', 1, 2,
       '[{"grupo":"Agrega algo más","opcion":"Tocineta","precio_extra":0},
         {"grupo":"Agrega algo más","opcion":"Tocineta","precio_extra":0},
         {"grupo":"Agrega algo más","opcion":"Cinco carnes extra","precio_extra":0},
         {"grupo":"Término de la carne","opcion":"Al punto","precio_extra":-5000}]'::jsonb,
       2
  from pedidos p, prueba.carta c;

select prueba.da('select nombre from pedido_items', 'La Clásica de la Casa',
  'el nombre del plato sale de la carta');
select prueba.da('select precio_unit::int::text from pedido_items', '37800',
  'el precio es el de la carta más la tocineta (32.900 + 4.900), una sola vez');
select prueba.da('select jsonb_array_length(opciones)::text from pedido_items', '2',
  'la opción inventada y la repetida no llegan a cocina');
select prueba.da('select (subtotal::int || ''/'' || total::int) from pedidos', '75600/75600',
  'el total del pedido se suma en la base');
select prueba.da('select usuario_id::text from pedido_items', 'aaaaaaaa-0000-0000-0000-000000000001',
  'cada plato queda a nombre de quien lo pidió');

select prueba.rechaza(
  $$insert into pedidos (usuario_id, sede_id, modalidad)
    select 'aaaaaaaa-0000-0000-0000-000000000001', sede, 'recoger' from prueba.carta$$,
  'un segundo pedido en el mismo minuto se rechaza');

select prueba.no_toca($$update pedidos set total = 1$$, 'la clienta no puede cambiar el total después');
select prueba.no_toca($$update pedidos set estado = 'entregado'$$, 'ni darse el pedido por entregado');
select prueba.no_toca($$delete from pedidos$$, 'ni borrar el pedido');

-- Estados y campos que no son de la app
select prueba.envejecer('aaaaaaaa-0000-0000-0000-000000000001');
select prueba.rechaza(
  $$insert into pedido_items (pedido_id, producto_id, nombre, precio_unit, cantidad, total_linea)
    select p.id, c.cafe, 'x', 1, 1, 1 from pedidos p, prueba.carta c$$,
  'no se añaden platos a un pedido que ya no es reciente');
select prueba.rechaza(
  $$insert into pedidos (usuario_id, sede_id, modalidad, puntos_ganados)
    select 'aaaaaaaa-0000-0000-0000-000000000001', sede, 'recoger', 99999 from prueba.carta$$,
  'la app no puede asignarse puntos al crear el pedido');
select prueba.rechaza(
  $$insert into pedidos (usuario_id, sede_id, modalidad, numero)
    select 'aaaaaaaa-0000-0000-0000-000000000001', sede, 'recoger', 1 from prueba.carta$$,
  'ni elegir el número de pedido');

insert into pedidos (usuario_id, sede_id, modalidad, estado, estado_pago)
select 'aaaaaaaa-0000-0000-0000-000000000001', sede, 'domicilio', 'entregado', 'reembolsado' from prueba.carta;
select prueba.da(
  $$select estado || '/' || estado_pago || '/' || total::int from pedidos order by numero desc limit 1$$,
  'pendiente_pago/pendiente/6900',
  'un pedido no puede nacer entregado ni reembolsado, y el domicilio es el de la sede');
select prueba.envejecer('aaaaaaaa-0000-0000-0000-000000000001');

-- Cupones: la misma cuenta que hace el carrito de la app
-- 20 %: (32.900 + 28.900) × 20 % = 12.360
insert into pedidos (usuario_id, sede_id, modalidad, cupon_id, descuento, total)
select 'aaaaaaaa-0000-0000-0000-000000000001', sede, 'recoger', veinte, 61000, 800 from prueba.carta;
insert into pedido_items (pedido_id, producto_id, nombre, precio_unit, cantidad, total_linea)
select (select id from pedidos order by numero desc limit 1), x, '-', 0, 1, 0
  from prueba.carta c, unnest(array[c.clasica, c.bowl]) as x;
select prueba.da(
  $$select subtotal::int || '-' || descuento::int || '=' || total::int from pedidos order by numero desc limit 1$$,
  '61800-12360=49440', 'el 20 % se calcula en la base, no se acepta el descuento de la app');
insert into cupones_usados (cupon_id, usuario_id, pedido_id)
select veinte, 'aaaaaaaa-0000-0000-0000-000000000001', (select id from pedidos order by numero desc limit 1) from prueba.carta;
select prueba.envejecer('aaaaaaaa-0000-0000-0000-000000000001');

-- El mismo cupón por segunda vez: es de un solo uso
insert into pedidos (usuario_id, sede_id, modalidad, cupon_id)
select 'aaaaaaaa-0000-0000-0000-000000000001', sede, 'recoger', veinte from prueba.carta;
insert into pedido_items (pedido_id, producto_id, nombre, precio_unit, cantidad, total_linea)
select (select id from pedidos order by numero desc limit 1), clasica, '-', 0, 1, 0 from prueba.carta;
select prueba.da(
  $$select descuento::int || '/' || total::int || '/' || coalesce(cupon_id::text, 'sin cupón') from pedidos order by numero desc limit 1$$,
  '0/32900/sin cupón', 'un cupón de un solo uso no descuenta la segunda vez');
select prueba.envejecer('aaaaaaaa-0000-0000-0000-000000000001');

-- 2x1 en hamburguesas: clásica (32.900), doble (41.900) y un bowl que no cuenta
insert into pedidos (usuario_id, sede_id, modalidad, cupon_id)
select 'aaaaaaaa-0000-0000-0000-000000000001', sede, 'recoger', dos_por_uno from prueba.carta;
insert into pedido_items (pedido_id, producto_id, nombre, precio_unit, cantidad, total_linea)
select (select id from pedidos order by numero desc limit 1), x, '-', 0, 1, 0
  from prueba.carta c, unnest(array[c.clasica, c.doble, c.bowl]) as x;
select prueba.da(
  $$select subtotal::int || '-' || descuento::int || '=' || total::int from pedidos order by numero desc limit 1$$,
  '103700-32900=70800', 'el 2x1 regala la hamburguesa más barata del par y no toca el bowl');
select prueba.envejecer('aaaaaaaa-0000-0000-0000-000000000001');

-- Tres hamburguesas iguales: un par, una gratis; la tercera se paga
insert into pedidos (usuario_id, sede_id, modalidad, cupon_id)
select 'aaaaaaaa-0000-0000-0000-000000000001', sede, 'recoger', dos_por_uno from prueba.carta;
insert into pedido_items (pedido_id, producto_id, nombre, precio_unit, cantidad, total_linea)
select (select id from pedidos order by numero desc limit 1), doble, '-', 0, 3, 0 from prueba.carta;
select prueba.da(
  $$select descuento::int || '/' || total::int from pedidos order by numero desc limit 1$$,
  '41900/83800', 'con tres hamburguesas el 2x1 regala una sola');
select prueba.envejecer('aaaaaaaa-0000-0000-0000-000000000001');

-- Domicilio gratis
insert into pedidos (usuario_id, sede_id, modalidad, cupon_id, costo_domicilio)
select 'aaaaaaaa-0000-0000-0000-000000000001', sede, 'domicilio', envio_gratis, 0 from prueba.carta;
insert into pedido_items (pedido_id, producto_id, nombre, precio_unit, cantidad, total_linea)
select (select id from pedidos order by numero desc limit 1), bowl, '-', 0, 1, 0 from prueba.carta;
select prueba.da(
  $$select costo_domicilio::int || '/' || total::int from pedidos order by numero desc limit 1$$,
  '0/28900', 'el cupón de domicilio gratis quita el envío');

select prueba.rechaza(
  $$insert into pedidos (usuario_id, sede_id, modalidad)
    select 'aaaaaaaa-0000-0000-0000-000000000001', sede, 'recoger' from prueba.carta$$,
  'el sexto pedido en una hora se rechaza aunque no sea en el mismo minuto');

-- Su perfil
select prueba.rechaza($$update perfiles set rol = 'admin'$$,      'la clienta no se puede hacer administradora');
select prueba.rechaza($$update perfiles set puntos = 999999$$,    'ni regalarse puntos');
select prueba.rechaza($$update perfiles set es_demo = true$$,     'ni tocar la marca de cuenta demo');
select prueba.da(
  $$with c as (update perfiles set nombre = 'Ana María', push_token = 'abc' returning 1) select count(*) from c$$,
  '1', 'sí puede cambiar su nombre y su token de avisos, y solo los suyos');
select prueba.da('select count(*) from perfiles', '1', 'solo ve su propio perfil');
select prueba.rechaza($$select public.sanear_pedido()$$, 'los disparadores no se pueden llamar a mano');
select prueba.rechaza($$select privado.recalcular_pedido(id) from pedidos limit 1$$,
  'ni la función que recalcula un pedido');


-- =====================================================================
-- BETO, OTRO CLIENTE · lo de Ana no es suyo
-- =====================================================================
select set_config('request.jwt.claims', :'beto', false) \gset ignorar_

select prueba.da('select count(*) from pedidos',      '0', 'un cliente no ve los pedidos de otra persona');
select prueba.da('select count(*) from pedido_items', '0', 'ni sus platos');
select prueba.rechaza(
  $$insert into pedidos (usuario_id, sede_id, modalidad)
    select 'aaaaaaaa-0000-0000-0000-000000000001', sede, 'recoger' from prueba.carta$$,
  'no puede crear un pedido a nombre de otra persona');
select prueba.rechaza($$insert into productos (categoria_id, nombre, precio)
    select id, 'Plato fantasma', 1 from categorias limit 1$$, 'un cliente no añade platos a la carta');
select prueba.no_toca($$update productos set precio = 1$$, 'ni cambia precios');
select prueba.no_toca($$delete from productos$$,           'ni borra platos');


-- =====================================================================
-- COCINA DEMO · ve todo, no cambia nada
-- =====================================================================
select set_config('request.jwt.claims', :'demo', false) \gset ignorar_

select prueba.da('select (count(*) >= 6)::text from pedidos', 'true', 'la cuenta demo de cocina ve los pedidos');
select prueba.no_toca($$update pedidos set estado = 'en_preparacion'$$, 'la cuenta demo no mueve pedidos');
select prueba.rechaza($$update perfiles set es_demo = false where email = 'cocina@lamesa.co'$$,
  'la cuenta demo no puede quitarse la marca de demo');
select prueba.rechaza($$update perfiles set rol = 'admin' where email = 'cocina@lamesa.co'$$,
  'ni subirse el rol');
select prueba.no_toca($$update productos set disponible = false$$, 'la cuenta demo no marca platos como agotados');
select prueba.rechaza($$insert into productos (categoria_id, nombre, precio)
    select id, 'Plato demo', 1 from categorias limit 1$$, 'ni añade platos');


-- =====================================================================
-- COCINA REAL
-- =====================================================================
select set_config('request.jwt.claims', :'cocina', false) \gset ignorar_

select prueba.da(
  $$with c as (update pedidos set estado = 'entregado'
                where numero = (select min(numero) from pedidos) returning puntos_ganados)
    select puntos_ganados::text from c$$,
  '75', 'cocina entrega el pedido y los puntos salen del total real (75.600 → 75)');
select prueba.da(
  $$select puntos::text from perfiles where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '75', 'los puntos llegan a la cuenta de la clienta');
select prueba.da(
  $$select count(*) from pedido_eventos where estado = 'entregado'$$,
  '1', 'el cambio de estado queda en la bitácora');
select prueba.da(
  $$with c as (insert into productos (categoria_id, nombre, precio)
               select id, 'Plato de temporada', 25000 from categorias limit 1 returning 1)
    select count(*) from c$$, '1', 'cocina añade un plato');
select prueba.da(
  $$with c as (update productos set disponible = false where nombre = 'Plato de temporada' returning 1)
    select count(*) from c$$, '1', 'lo marca como agotado');

-- Un plato agotado no se puede pedir
select set_config('request.jwt.claims', :'beto', false) \gset ignorar_
insert into pedidos (usuario_id, sede_id, modalidad)
select 'bbbbbbbb-0000-0000-0000-000000000002', sede, 'recoger' from prueba.carta;
select prueba.rechaza(
  $$insert into pedido_items (pedido_id, producto_id, nombre, precio_unit, cantidad, total_linea)
    select (select id from pedidos order by numero desc limit 1), id, '-', 0, 1, 0
      from productos where nombre = 'Plato de temporada'$$,
  'un plato agotado no entra en un pedido');

select set_config('request.jwt.claims', :'cocina', false) \gset ignorar_
select prueba.da(
  $$with c as (delete from productos where nombre = 'Plato de temporada' returning 1)
    select count(*) from c$$, '1', 'y cocina lo retira de la carta');


-- =====================================================================
-- LA BASE ENTERA
-- =====================================================================
reset role;
select set_config('request.jwt.claims', '', false) \gset ignorar_

select prueba.da(
  $$select count(*) from pg_tables where schemaname = 'public' and not rowsecurity$$,
  '0', 'no queda ninguna tabla pública sin seguridad por fila');
select prueba.da(
  $$select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef
       and has_function_privilege('authenticated', p.oid, 'execute')$$,
  '0', 'ninguna función con privilegios queda al alcance de la API');
select prueba.da(
  $$select count(*) from information_schema.role_table_grants
     where table_schema = 'public' and grantee in ('anon', 'authenticated') and privilege_type = 'TRUNCATE'$$,
  '0', 'la API no puede vaciar tablas');
select prueba.da(
  $$select count(*) from pg_constraint c
     where c.contype = 'f' and c.connamespace = 'public'::regnamespace
       and not exists (select 1 from pg_index i
                        where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1])$$,
  '0', 'todas las claves foráneas tienen índice');

-- ---------- resumen ----------
\pset tuples_only off
\pset format aligned
select case when ok then 'ok   ' else 'FALLA' end as " ", que as prueba from prueba.resultados order by n;
select count(*) filter (where ok) as pasan, count(*) filter (where not ok) as fallan from prueba.resultados;

do $$
begin
  if exists (select 1 from prueba.resultados where not ok) then
    raise exception 'Hay pruebas de seguridad que fallan.';
  end if;
end $$;

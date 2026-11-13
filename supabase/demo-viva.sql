-- =====================================================================
-- LA MESA · Que el tablero de demostración no envejezca  (opcional)
-- Se corre DESPUÉS de endurecimiento.sql. Es idempotente.
--
-- El panel del portafolio enseña los pedidos reales de la base. El último
-- se hizo en agosto, así que quien entra hoy ve un tablero titulado
-- "Pedidos de hoy" con relojes de 87 días. No es un fallo del panel: es
-- una cocina sin clientes.
--
-- Esto no inventa nada en la interfaz. Marca la cuenta de cliente pública
-- como cuenta demo, le deja unos cuantos pedidos repartidos por las
-- columnas y, cada diez minutos, vuelve a poner sus relojes en hora.
-- Solo toca pedidos de cuentas con `es_demo`; los de cualquier otra
-- persona no se mueven.
-- =====================================================================

update public.perfiles
   set es_demo = true,
       nombre  = 'Mesa de demostración'
 where email = 'demo@lamesa.co';

-- Pone en hora los pedidos demo según la columna en la que están. No
-- cambia el estado de ninguno: los puntos y la bitácora ni se enteran.
create or replace function privado.refrescar_demo() returns void
language sql security definer set search_path = public, pg_temp as $$
  with en_fila as (
    select p.id, p.estado,
           row_number() over (partition by p.estado order by p.numero desc) as puesto
      from pedidos p
      join perfiles c on c.id = p.usuario_id
     where c.es_demo and c.rol = 'cliente'
  )
  update pedidos p
     set creado_en = now() - make_interval(mins =>
           case f.estado
             when 'recibido'       then  1 +  3 * (f.puesto - 1)
             when 'en_preparacion' then  7 +  6 * (f.puesto - 1)
             when 'listo'          then 16 +  5 * (f.puesto - 1)
             when 'en_camino'      then 22 +  5 * (f.puesto - 1)
             else                       35 + 17 * (f.puesto - 1)
           end::int)
    from en_fila f
   where f.id = p.id;
$$;

revoke all on function privado.refrescar_demo() from public, anon, authenticated;

-- Unos pedidos de ejemplo, una sola vez. Los precios salen de la carta.
do $$
declare
  demo  uuid;
  sede  uuid := '11111111-1111-1111-1111-111111111111';
  nuevo uuid;
  caso  record;
  linea record;
begin
  select id into demo from perfiles where email = 'demo@lamesa.co';
  if demo is null then
    raise notice 'No existe demo@lamesa.co: se omiten los pedidos de ejemplo.';
    return;
  end if;
  if exists (select 1 from pedidos where usuario_id = demo and notas like '%[demo]') then
    return;
  end if;

  for caso in
    select * from (values
      ('recibido',       'domicilio', 'tarjeta',     'Sin cebolla, por favor. [demo]',
         array['Bowl Ensalada La Mesa', 'Café del Poblado'],            array[1, 1]),
      ('recibido',       'recoger',   'efectivo',    'Paso en diez minutos. [demo]',
         array['Doble Mandarina', 'Postre de Maracuyá'],                array[2, 1]),
      ('en_preparacion', 'domicilio', 'bancolombia', 'Portería, torre 2. [demo]',
         array['Costilla BBQ de la Mesa', 'Bowl de Pollo y Aguacate', 'Limonada de Coco'], array[1, 1, 2]),
      ('en_preparacion', 'recoger',   'nequi',       '[demo]',
         array['La Clásica de la Casa', 'Limonada de Coco'],            array[1, 2]),
      ('listo',          'recoger',   'pse',         '[demo]',
         array['Punta de Anca a la Brasa'],                             array[1]),
      ('listo',          'domicilio', 'nequi',       'Timbre dañado, llamar al llegar. [demo]',
         array['La Clásica de la Casa', 'Brownie para Compartir'],      array[2, 1])
    ) as v(estado, modalidad, metodo, notas, platos, cantidades)
  loop
    insert into pedidos (usuario_id, sede_id, modalidad, estado, metodo_pago, estado_pago, notas)
    values (demo, sede, caso.modalidad::modalidad_pedido, caso.estado::estado_pedido,
            caso.metodo::metodo_pago,
            case when caso.metodo = 'efectivo' then 'pendiente' else 'aprobado' end::estado_pago,
            caso.notas)
    returning id into nuevo;

    for linea in
      select p.id, p.nombre, p.precio, c.cantidad
        from unnest(caso.platos, caso.cantidades) as c(plato, cantidad)
        join productos p on p.nombre = c.plato
    loop
      insert into pedido_items (pedido_id, producto_id, usuario_id, nombre, precio_unit, cantidad, total_linea)
      values (nuevo, linea.id, demo, linea.nombre, linea.precio, linea.cantidad, linea.precio * linea.cantidad);
    end loop;
  end loop;
end $$;

select privado.refrescar_demo();

-- Cada diez minutos, si el proyecto tiene pg_cron (en Supabase se activa
-- en Database → Extensions). Sin él, el tablero se pone en hora cada vez
-- que alguien corra `select privado.refrescar_demo();`.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'la-mesa-demo-viva';
    perform cron.schedule('la-mesa-demo-viva', '*/10 * * * *', 'select privado.refrescar_demo()');
  else
    raise notice 'pg_cron no está activo: el tablero demo no se pondrá en hora solo.';
  end if;
end $$;

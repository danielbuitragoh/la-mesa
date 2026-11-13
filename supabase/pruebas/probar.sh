#!/usr/bin/env bash
# Levanta el esquema completo en una base vacía y corre las pruebas de
# seguridad. Necesita un PostgreSQL al que `psql` llegue sin preguntar
# (PGHOST, PGUSER, PGPASSWORD) y permiso para crear bases de datos.
#
#   bash supabase/pruebas/probar.sh
set -euo pipefail
cd "$(dirname "$0")/.."

BASE="${BASE_DE_PRUEBA:-lamesa_prueba}"
psql -q -d postgres -c "drop database if exists ${BASE}" -c "create database ${BASE}"

correr() { psql -q -v ON_ERROR_STOP=1 -d "${BASE}" -f "$1" > /dev/null; }

correr pruebas/00-simular-supabase.sql
correr schema.sql
correr seed.sql
correr correcciones.sql
correr cuenta-demo.sql
correr endurecimiento.sql
correr endurecimiento.sql          # dos veces: tiene que poder repetirse

psql -q -v ON_ERROR_STOP=1 -d "${BASE}" -f pruebas/seguridad.sql

# El guion opcional de la demo también tiene que correr, y repetirse.
psql -q -d "${BASE}" -c "insert into auth.users (id, email) values (gen_random_uuid(), 'demo@lamesa.co')" > /dev/null
correr demo-viva.sql
correr demo-viva.sql
psql -q -At -d "${BASE}" -c "select 'demo viva: ' || count(*) || ' pedidos, el más viejo de hace ' || max(round(extract(epoch from now() - p.creado_en) / 60)) || ' min, total medio ' || round(avg(total)) from pedidos p join perfiles c on c.id = p.usuario_id where c.es_demo and c.rol = 'cliente'"


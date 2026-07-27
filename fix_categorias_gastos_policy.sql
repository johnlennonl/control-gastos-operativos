-- Ejecuta este archivo en una pestaña nueva del SQL Editor de Supabase.
-- No reemplaza el script principal. Solo habilita borrar categorias guardadas
-- y permite limpiar categorias de prueba si lo necesitas.

begin;

alter table public.categorias_gastos enable row level security;

-- Permitir que usuarios autenticados vean categorias.
drop policy if exists "Categorias visibles para usuarios autenticados" on public.categorias_gastos;
create policy "Categorias visibles para usuarios autenticados"
on public.categorias_gastos
for select
to authenticated
using (true);

-- Permitir que usuarios autenticados creen categorias permanentes.
drop policy if exists "Usuarios autenticados crean categorias" on public.categorias_gastos;
create policy "Usuarios autenticados crean categorias"
on public.categorias_gastos
for insert
to authenticated
with check (true);

-- Permitir que usuarios autenticados eliminen categorias guardadas.
-- Los gastos historicos no se borran: categoria_id queda null por ON DELETE SET NULL
-- y categoria_nombre conserva el texto usado en el gasto.
drop policy if exists "Usuarios autenticados eliminan categorias" on public.categorias_gastos;
create policy "Usuarios autenticados eliminan categorias"
on public.categorias_gastos
for delete
to authenticated
using (true);

commit;

-- OPCIONAL: si quieres borrar de una vez categorias de prueba desde SQL,
-- descomenta y ajusta los nombres. No borra gastos historicos.
--
-- delete from public.categorias_gastos
-- where nombre in (
--     'FLETE MARACAIBO',
--     'Pago de flete'
-- );

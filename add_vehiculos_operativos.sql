-- Ejecuta este parche en Supabase SQL Editor si tu base ya existe.
-- Agrega datos estructurados para reportar gastos por vehiculo y placa.

alter table public.gastos_operativos
    add column if not exists vehiculo_nombre text,
    add column if not exists vehiculo_placa text,
    add column if not exists litros_gasolina numeric(10,2);
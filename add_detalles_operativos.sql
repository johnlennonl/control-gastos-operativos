-- Ejecuta este parche en Supabase SQL Editor si tu base ya existe.
-- Agrega los campos usados por las nuevas observaciones operativas.

alter table public.gastos_operativos
    add column if not exists vehiculo_nombre text,
    add column if not exists vehiculo_placa text,
    add column if not exists kilometraje integer,
    add column if not exists litros_gasolina numeric(10,2),
    add column if not exists detalle_actividad text;
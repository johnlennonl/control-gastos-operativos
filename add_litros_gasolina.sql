-- Ejecuta este parche en Supabase SQL Editor si tu base ya existe.
-- Agrega el campo opcional para registrar litros cargados en gastos de gasolina.

alter table public.gastos_operativos
    add column if not exists litros_gasolina numeric(10,2);

-- Ejecutar en el SQL Editor de Supabase para habilitar forma de pago y tipo de tasa.

alter table public.gastos_operativos
    add column if not exists forma_pago text,
    add column if not exists tipo_tasa text not null default 'DIRECTO';

alter table public.gastos_operativos
    drop constraint if exists gastos_operativos_tipo_tasa_check;

update public.gastos_operativos
set tipo_tasa = 'BCV_USD'
where tipo_tasa is null or tipo_tasa = 'BCV';

alter table public.gastos_operativos
    add constraint gastos_operativos_tipo_tasa_check
    check (tipo_tasa in ('DIRECTO', 'BCV_USD', 'BCV_EUR', 'MANUAL', 'BINANCE'));

update public.gastos_operativos
set tipo_tasa = 'BCV_USD'
where tipo_tasa is null;

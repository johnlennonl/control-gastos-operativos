create extension if not exists "pgcrypto";

create table if not exists public.categorias_gastos (
    id uuid primary key default gen_random_uuid(),
    nombre text not null unique
);

insert into public.categorias_gastos (nombre) values
    ('COMIDA'),
    ('HERRAMIENTAS'),
    ('MATERIALES'),
    ('EQUIPOS'),
    ('INSUMOS'),
    ('VEHICULOS')
on conflict (nombre) do nothing;

create table if not exists public.gastos_operativos (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
    user_email text,
    fecha date not null default current_date,
    categoria_id uuid references public.categorias_gastos(id) on update cascade on delete set null,
    categoria_nombre text not null,
    numero_factura text,
    moneda text not null check (moneda in ('USD', 'VES')),
    monto_usd numeric(10,2) not null default 0,
    tasa_bcv numeric(10,4) not null default 0,
    monto_ves numeric(10,2) not null default 0,
    descripcion text,
    responsable text not null,
    comprobante_url text,
    created_at timestamp with time zone not null default now()
);

alter table public.gastos_operativos
    add column if not exists user_id uuid references auth.users(id) on delete cascade default auth.uid();

alter table public.gastos_operativos
    add column if not exists user_email text;

alter table public.categorias_gastos
    drop column if exists requiere_kilometraje;

alter table public.gastos_operativos
    drop column if exists kilometraje;

create index if not exists gastos_operativos_fecha_idx on public.gastos_operativos (fecha desc);
create index if not exists gastos_operativos_categoria_idx on public.gastos_operativos (categoria_id);
create index if not exists gastos_operativos_responsable_idx on public.gastos_operativos (responsable);
create index if not exists gastos_operativos_user_idx on public.gastos_operativos (user_id);

alter table public.categorias_gastos enable row level security;
alter table public.gastos_operativos enable row level security;

drop policy if exists "Categorias visibles para usuarios autenticados" on public.categorias_gastos;
create policy "Categorias visibles para usuarios autenticados"
on public.categorias_gastos for select
to authenticated
using (true);

drop policy if exists "Usuarios autenticados crean categorias" on public.categorias_gastos;
create policy "Usuarios autenticados crean categorias"
on public.categorias_gastos for insert
to authenticated
with check (true);

drop policy if exists "Usuarios autenticados eliminan categorias" on public.categorias_gastos;
create policy "Usuarios autenticados eliminan categorias"
on public.categorias_gastos for delete
to authenticated
using (true);

drop policy if exists "Usuarios autenticados ven historico operativo" on public.gastos_operativos;
create policy "Usuarios autenticados ven historico operativo"
on public.gastos_operativos for select
to authenticated
using (true);

drop policy if exists "Usuarios crean sus gastos" on public.gastos_operativos;
create policy "Usuarios crean sus gastos"
on public.gastos_operativos for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Usuarios actualizan sus gastos" on public.gastos_operativos;
create policy "Usuarios actualizan sus gastos"
on public.gastos_operativos for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Usuarios eliminan sus gastos" on public.gastos_operativos;
create policy "Usuarios eliminan sus gastos"
on public.gastos_operativos for delete
to authenticated
drop policy if exists "Usuarios eliminan sus gastos" on public.gastos_operativos;

create policy "Usuarios eliminan sus gastos"
on public.gastos_operativos
for delete
to authenticated
using (
    user_id = auth.uid()
    or user_id is null
    or user_email = (auth.jwt() ->> 'email')
);

drop policy if exists "Usuarios eliminan sus comprobantes" on storage.objects;

create policy "Usuarios eliminan sus comprobantes"
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'comprobantes-gastos'
    and (
        (storage.foldername(name))[1] = auth.uid()::text
        or owner = auth.uid()
    )
);

insert into storage.buckets (id, name, public)
values ('comprobantes-gastos', 'comprobantes-gastos', true)
on conflict (id) do nothing;

drop policy if exists "Usuarios autenticados suben comprobantes" on storage.objects;
create policy "Usuarios autenticados suben comprobantes"
on storage.objects for insert
to authenticated
with check (
    bucket_id = 'comprobantes-gastos'
    and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Usuarios autenticados ven comprobantes" on storage.objects;
create policy "Usuarios autenticados ven comprobantes"
on storage.objects for select
to authenticated
using (bucket_id = 'comprobantes-gastos');

drop policy if exists "Usuarios eliminan sus comprobantes" on storage.objects;
create policy "Usuarios eliminan sus comprobantes"
on storage.objects for delete
to authenticated
using (
    bucket_id = 'comprobantes-gastos'
    and (storage.foldername(name))[1] = auth.uid()::text
);

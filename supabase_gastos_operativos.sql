create extension if not exists "pgcrypto";

create table if not exists public.categorias_gastos (
    id uuid primary key default gen_random_uuid(),
    nombre text not null unique
);

create table if not exists public.usuarios_roles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    email text,
    nombre text,
    rol text not null default 'operador' check (rol in ('admin', 'operador')),
    created_at timestamp with time zone not null default now()
);

create table if not exists public.usuarios_perfiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    email text,
    nombre text not null,
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now()
);

alter table public.usuarios_roles
    add column if not exists nombre text;

create unique index if not exists usuarios_roles_email_idx
on public.usuarios_roles (lower(email))
where email is not null;

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
    forma_pago text,
    tipo_tasa text not null default 'DIRECTO' check (tipo_tasa in ('DIRECTO', 'BCV_USD', 'BCV_EUR', 'MANUAL', 'BINANCE')),
    monto_usd numeric(10,2) not null default 0,
    tasa_bcv numeric(10,4) not null default 0,
    monto_ves numeric(10,2) not null default 0,
    kilometraje integer,
    detalle_actividad text,
    descripcion text,
    responsable text not null,
    comprobante_url text,
    created_at timestamp with time zone not null default now()
);

alter table public.gastos_operativos
    add column if not exists user_id uuid references auth.users(id) on delete cascade default auth.uid();

alter table public.gastos_operativos
    add column if not exists user_email text;

alter table public.gastos_operativos
    add column if not exists forma_pago text,
    add column if not exists tipo_tasa text not null default 'DIRECTO';

alter table public.gastos_operativos
    add column if not exists kilometraje integer,
    add column if not exists detalle_actividad text;

alter table public.gastos_operativos
    drop constraint if exists gastos_operativos_tipo_tasa_check;

update public.gastos_operativos
set tipo_tasa = 'BCV_USD'
where tipo_tasa is null or tipo_tasa = 'BCV';

alter table public.gastos_operativos
    add constraint gastos_operativos_tipo_tasa_check
    check (tipo_tasa in ('DIRECTO', 'BCV_USD', 'BCV_EUR', 'MANUAL', 'BINANCE'));

alter table public.categorias_gastos
    drop column if exists requiere_kilometraje;

create index if not exists gastos_operativos_fecha_idx on public.gastos_operativos (fecha desc);
create index if not exists gastos_operativos_categoria_idx on public.gastos_operativos (categoria_id);
create index if not exists gastos_operativos_responsable_idx on public.gastos_operativos (responsable);
create index if not exists gastos_operativos_user_idx on public.gastos_operativos (user_id);

alter table public.categorias_gastos enable row level security;
alter table public.gastos_operativos enable row level security;
alter table public.usuarios_roles enable row level security;
alter table public.usuarios_perfiles enable row level security;

drop policy if exists "Usuarios ven su propio rol" on public.usuarios_roles;
create policy "Usuarios ven su propio rol"
on public.usuarios_roles for select
to authenticated
using (
    user_id = auth.uid()
    or lower(email) = lower(auth.jwt() ->> 'email')
);

drop policy if exists "Usuarios gestionan su perfil" on public.usuarios_perfiles;
create policy "Usuarios gestionan su perfil"
on public.usuarios_perfiles for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

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
using (
    user_id = auth.uid()
    or exists (
        select 1
        from public.usuarios_roles ur
        where ur.user_id = auth.uid()
          and ur.rol = 'admin'
    )
);

drop policy if exists "Usuarios crean sus gastos" on public.gastos_operativos;
create policy "Usuarios crean sus gastos"
on public.gastos_operativos for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Usuarios actualizan sus gastos" on public.gastos_operativos;
create policy "Usuarios actualizan sus gastos"
on public.gastos_operativos for update
to authenticated
using (
    user_id = auth.uid()
    or exists (
        select 1
        from public.usuarios_roles ur
        where ur.user_id = auth.uid()
          and ur.rol = 'admin'
    )
)
with check (
    user_id = auth.uid()
    or exists (
        select 1
        from public.usuarios_roles ur
        where ur.user_id = auth.uid()
          and ur.rol = 'admin'
    )
);

drop policy if exists "Usuarios eliminan sus gastos" on public.gastos_operativos;
create policy "Usuarios eliminan sus gastos"
on public.gastos_operativos
for delete
to authenticated
using (
    user_id = auth.uid()
    or user_id is null
    or user_email = (auth.jwt() ->> 'email')
    or exists (
        select 1
        from public.usuarios_roles ur
        where ur.user_id = auth.uid()
          and ur.rol = 'admin'
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
    and (
        (storage.foldername(name))[1] = auth.uid()::text
        or owner = auth.uid()
    )
);

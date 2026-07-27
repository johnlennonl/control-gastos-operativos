-- Ejecuta este parche en Supabase SQL Editor si tu base ya existe.
-- Crea roles simples para controlar quien puede generar Excel desde la app.

create table if not exists public.usuarios_roles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    email text,
    nombre text,
    rol text not null default 'operador' check (rol in ('admin', 'operador')),
    created_at timestamp with time zone not null default now()
);

alter table public.usuarios_roles
    add column if not exists nombre text;

create table if not exists public.usuarios_perfiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    email text,
    nombre text not null,
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now()
);

create unique index if not exists usuarios_roles_email_idx
on public.usuarios_roles (lower(email))
where email is not null;

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

-- Los nombres ya no tienes que cargarlos aqui: cada usuario lo escribe
-- dentro de la app en su primer ingreso.

-- Marca usuarios como admin. Cambia los correos por los reales.
-- insert into public.usuarios_roles (user_id, email, rol)
-- select id, email, 'admin'
-- from auth.users
-- where lower(email) in (
--     lower('jefe1@empresa.com'),
--     lower('jefe2@empresa.com')
-- )
-- on conflict (user_id) do update
-- set email = excluded.email,
--     rol = excluded.rol;

-- OPCIONAL: restringe el historico para que admin vea todo
-- y operadores solo puedan leer sus propios registros.
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

-- Permite que admin edite y elimine registros del historico completo.
-- Operadores solo pueden editar/eliminar sus propios registros.
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
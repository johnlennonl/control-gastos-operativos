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

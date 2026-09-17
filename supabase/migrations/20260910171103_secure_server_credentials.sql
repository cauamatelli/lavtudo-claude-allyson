-- As operações administrativas são executadas apenas pelo backend autenticado
-- da aplicação, usando SUPABASE_SECRET_KEY. O papel anon conserva somente a
-- leitura necessária ao acompanhamento por URL permanente da máquina.

revoke insert, update, delete on table public.lavtudo_washes from anon, authenticated;
revoke insert, update, delete on table public.lavtudo_wash_history from anon, authenticated;
revoke all on sequence public.lavtudo_washes_id_seq from anon, authenticated;
revoke all on sequence public.lavtudo_wash_history_id_seq from anon, authenticated;

grant select, insert, update, delete on table public.lavtudo_machines to service_role;
grant select, insert, update, delete on table public.lavtudo_washes to service_role;
grant select, insert, update, delete on table public.lavtudo_wash_history to service_role;
grant usage, select on sequence public.lavtudo_washes_id_seq to service_role;
grant usage, select on sequence public.lavtudo_wash_history_id_seq to service_role;

drop policy if exists "lavtudo_machine_or_admin_read_machines" on public.lavtudo_machines;
drop policy if exists "lavtudo_machine_or_admin_read_washes" on public.lavtudo_washes;
drop policy if exists "lavtudo_machine_or_admin_read_history" on public.lavtudo_wash_history;
drop policy if exists "lavtudo_admin_create_washes" on public.lavtudo_washes;
drop policy if exists "lavtudo_admin_update_washes" on public.lavtudo_washes;
drop policy if exists "lavtudo_admin_create_history" on public.lavtudo_wash_history;
drop policy if exists "lavtudo_admin_delete_history" on public.lavtudo_wash_history;

create policy "lavtudo_public_read_machine"
on public.lavtudo_machines
for select
to anon
using (id = private.lavtudo_request_header('x-lavtudo-machine-id'));

create policy "lavtudo_public_read_machine_washes"
on public.lavtudo_washes
for select
to anon
using (machine_id = private.lavtudo_request_header('x-lavtudo-machine-id'));

create policy "lavtudo_public_read_machine_history"
on public.lavtudo_wash_history
for select
to anon
using (
  exists (
    select 1
    from public.lavtudo_washes as wash
    where wash.id = wash_id
      and wash.machine_id = private.lavtudo_request_header('x-lavtudo-machine-id')
  )
);

revoke execute on function private.lavtudo_admin_ok(text, text)
  from public, anon, authenticated;
grant execute on function private.lavtudo_admin_ok(text, text) to service_role;

revoke execute on function public.lavtudo_list_washes(text, text)
  from public, anon, authenticated;
revoke execute on function public.lavtudo_create_wash(text, text, text, text, text, integer)
  from public, anon, authenticated;
revoke execute on function public.lavtudo_set_wash_status(text, text, text, text)
  from public, anon, authenticated;
revoke execute on function public.lavtudo_reset_wash(text, text, text)
  from public, anon, authenticated;
revoke execute on function public.lavtudo_list_machines(text, text)
  from public, anon, authenticated;
revoke execute on function public.lavtudo_start_machine_wash(text, text, text, text, integer, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.lavtudo_set_machine_status(text, text, text, text)
  from public, anon, authenticated;
revoke execute on function public.lavtudo_release_machine(text, text, text)
  from public, anon, authenticated;

grant execute on function public.lavtudo_list_washes(text, text) to service_role;
grant execute on function public.lavtudo_create_wash(text, text, text, text, text, integer) to service_role;
grant execute on function public.lavtudo_set_wash_status(text, text, text, text) to service_role;
grant execute on function public.lavtudo_reset_wash(text, text, text) to service_role;
grant execute on function public.lavtudo_list_machines(text, text) to service_role;
grant execute on function public.lavtudo_start_machine_wash(text, text, text, text, integer, timestamptz) to service_role;
grant execute on function public.lavtudo_set_machine_status(text, text, text, text) to service_role;
grant execute on function public.lavtudo_release_machine(text, text, text) to service_role;

-- A publicação deixa o banco preparado para Realtime. A aplicação atual usa
-- polling curto nas rotas server-side, evitando expor credenciais no browser.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'lavtudo_machines'
  ) then
    alter publication supabase_realtime add table public.lavtudo_machines;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'lavtudo_washes'
  ) then
    alter publication supabase_realtime add table public.lavtudo_washes;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'lavtudo_wash_history'
  ) then
    alter publication supabase_realtime add table public.lavtudo_wash_history;
  end if;
end;
$$;

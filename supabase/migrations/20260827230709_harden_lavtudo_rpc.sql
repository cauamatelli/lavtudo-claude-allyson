create or replace function private.lavtudo_request_header(p_name text)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    current_setting('request.headers', true)::jsonb ->> lower(p_name),
    ''
  );
$$;

alter function public.lavtudo_get_wash(text) security invoker;
alter function public.lavtudo_list_washes(text, text) security invoker;
alter function public.lavtudo_create_wash(text, text, text, text, text, integer) security invoker;
alter function public.lavtudo_set_wash_status(text, text, text, text) security invoker;
alter function public.lavtudo_reset_wash(text, text, text) security invoker;

grant usage on schema private to anon;
grant execute on function private.lavtudo_admin_ok(text, text) to anon;
grant execute on function private.lavtudo_status_label(text) to anon;
grant execute on function private.lavtudo_wash_json(bigint) to anon;
grant execute on function private.lavtudo_request_header(text) to anon;

grant select, insert, update on table public.lavtudo_washes to anon;
grant select, insert, delete on table public.lavtudo_wash_history to anon;
grant usage, select on sequence public.lavtudo_washes_id_seq to anon;
grant usage, select on sequence public.lavtudo_wash_history_id_seq to anon;

create policy "lavtudo_tracking_or_admin_read_washes"
on public.lavtudo_washes
for select
to anon
using (
  id::text = private.lavtudo_request_header('x-lavtudo-wash-id')
  or private.lavtudo_admin_ok(
    private.lavtudo_request_header('x-lavtudo-admin-user'),
    private.lavtudo_request_header('x-lavtudo-admin-password')
  )
);

create policy "lavtudo_admin_create_washes"
on public.lavtudo_washes
for insert
to anon
with check (
  private.lavtudo_admin_ok(
    private.lavtudo_request_header('x-lavtudo-admin-user'),
    private.lavtudo_request_header('x-lavtudo-admin-password')
  )
);

create policy "lavtudo_admin_update_washes"
on public.lavtudo_washes
for update
to anon
using (
  private.lavtudo_admin_ok(
    private.lavtudo_request_header('x-lavtudo-admin-user'),
    private.lavtudo_request_header('x-lavtudo-admin-password')
  )
)
with check (
  private.lavtudo_admin_ok(
    private.lavtudo_request_header('x-lavtudo-admin-user'),
    private.lavtudo_request_header('x-lavtudo-admin-password')
  )
);

create policy "lavtudo_tracking_or_admin_read_history"
on public.lavtudo_wash_history
for select
to anon
using (
  wash_id::text = private.lavtudo_request_header('x-lavtudo-wash-id')
  or private.lavtudo_admin_ok(
    private.lavtudo_request_header('x-lavtudo-admin-user'),
    private.lavtudo_request_header('x-lavtudo-admin-password')
  )
);

create policy "lavtudo_admin_create_history"
on public.lavtudo_wash_history
for insert
to anon
with check (
  private.lavtudo_admin_ok(
    private.lavtudo_request_header('x-lavtudo-admin-user'),
    private.lavtudo_request_header('x-lavtudo-admin-password')
  )
);

create policy "lavtudo_admin_delete_history"
on public.lavtudo_wash_history
for delete
to anon
using (
  private.lavtudo_admin_ok(
    private.lavtudo_request_header('x-lavtudo-admin-user'),
    private.lavtudo_request_header('x-lavtudo-admin-password')
  )
);

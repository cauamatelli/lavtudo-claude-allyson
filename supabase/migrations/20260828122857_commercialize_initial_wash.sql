update public.lavtudo_washes
set customer_name = 'Cliente LavTudo'
where id = 1024;

create or replace function public.lavtudo_reset_wash(
  p_user text,
  p_password text,
  p_id text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  target_wash_id bigint;
  changed_at timestamptz := now();
  history_actor text := 'employee';
begin
  if not private.lavtudo_admin_ok(p_user, p_password) then
    raise insufficient_privilege using message = 'Credenciais administrativas inválidas.';
  end if;
  if p_id !~ '^[0-9]{1,12}$' then
    return null;
  end if;
  target_wash_id := p_id::bigint;

  if target_wash_id = 1024 then
    insert into public.lavtudo_washes (
      id, customer_name, machine_label, service_type, status, estimated_minutes,
      created_at, updated_at, started_at, ready_at
    ) overriding system value values (
      1024, 'Cliente LavTudo', 'Lavadora 01', 'wash-dry', 'waiting', 45,
      changed_at, changed_at, null, null
    )
    on conflict (id) do update set
      customer_name = excluded.customer_name,
      machine_label = excluded.machine_label,
      service_type = excluded.service_type,
      status = excluded.status,
      estimated_minutes = excluded.estimated_minutes,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      started_at = null,
      ready_at = null;
    history_actor := 'system';
  else
    update public.lavtudo_washes
    set status = 'waiting', updated_at = changed_at, started_at = null, ready_at = null
    where id = target_wash_id;
    if not found then
      return null;
    end if;
  end if;

  delete from public.lavtudo_wash_history as history
  where history.wash_id = target_wash_id;
  insert into public.lavtudo_wash_history (wash_id, status, label, occurred_at, actor)
  values (target_wash_id, 'waiting', private.lavtudo_status_label('waiting'), changed_at, history_actor);

  return private.lavtudo_wash_json(target_wash_id);
end;
$$;

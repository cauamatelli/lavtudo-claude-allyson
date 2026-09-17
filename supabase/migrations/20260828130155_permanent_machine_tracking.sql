create table if not exists public.lavtudo_machines (
  id text primary key check (id ~ '^(lavadora|secadora)-0[1-4]$'),
  label text not null unique,
  kind text not null check (kind in ('washer', 'dryer')),
  position integer not null check (position between 1 and 4),
  created_at timestamptz not null default now(),
  unique (kind, position)
);

insert into public.lavtudo_machines (id, label, kind, position) values
  ('lavadora-01', 'Lavadora 01', 'washer', 1),
  ('lavadora-02', 'Lavadora 02', 'washer', 2),
  ('lavadora-03', 'Lavadora 03', 'washer', 3),
  ('lavadora-04', 'Lavadora 04', 'washer', 4),
  ('secadora-01', 'Secadora 01', 'dryer', 1),
  ('secadora-02', 'Secadora 02', 'dryer', 2),
  ('secadora-03', 'Secadora 03', 'dryer', 3),
  ('secadora-04', 'Secadora 04', 'dryer', 4)
on conflict (id) do update set
  label = excluded.label,
  kind = excluded.kind,
  position = excluded.position;

alter table public.lavtudo_washes add column if not exists machine_id text;

update public.lavtudo_washes
set machine_id = case
  when lower(machine_label) like 'secadora 01%' then 'secadora-01'
  when lower(machine_label) like 'secadora 02%' then 'secadora-02'
  when lower(machine_label) like 'secadora 03%' then 'secadora-03'
  when lower(machine_label) like 'secadora 04%' then 'secadora-04'
  when lower(machine_label) like 'lavadora 02%' then 'lavadora-02'
  when lower(machine_label) like 'lavadora 03%' then 'lavadora-03'
  when lower(machine_label) like 'lavadora 04%' then 'lavadora-04'
  else 'lavadora-01'
end
where machine_id is null;

alter table public.lavtudo_washes alter column machine_id set not null;
alter table public.lavtudo_washes
  drop constraint if exists lavtudo_washes_machine_id_fkey;
alter table public.lavtudo_washes
  add constraint lavtudo_washes_machine_id_fkey
  foreign key (machine_id) references public.lavtudo_machines(id);

alter table public.lavtudo_washes
  drop constraint if exists lavtudo_washes_service_type_check;
update public.lavtudo_washes
set service_type = case when machine_id like 'secadora-%' then 'drying' else 'standard' end;
alter table public.lavtudo_washes
  add constraint lavtudo_washes_service_type_check
  check (service_type in ('standard', 'delicate', 'heavy', 'drying'));

with released as (
  update public.lavtudo_washes
  set status = 'collected', updated_at = now(), ready_at = coalesce(ready_at, now())
  where status not in ('collected', 'cancelled')
  returning id
)
insert into public.lavtudo_wash_history (wash_id, status, label, actor)
select id, 'collected', 'Máquina liberada', 'system' from released;

create unique index if not exists lavtudo_one_active_wash_per_machine_idx
  on public.lavtudo_washes (machine_id)
  where status not in ('collected', 'cancelled');
create index if not exists lavtudo_washes_machine_updated_idx
  on public.lavtudo_washes (machine_id, updated_at desc);

alter table public.lavtudo_machines enable row level security;
alter table public.lavtudo_machines force row level security;
revoke all on table public.lavtudo_machines from public, anon, authenticated;
grant select on table public.lavtudo_machines to anon;

drop policy if exists "lavtudo_tracking_or_admin_read_washes" on public.lavtudo_washes;
drop policy if exists "lavtudo_admin_create_washes" on public.lavtudo_washes;
drop policy if exists "lavtudo_admin_update_washes" on public.lavtudo_washes;
drop policy if exists "lavtudo_tracking_or_admin_read_history" on public.lavtudo_wash_history;
drop policy if exists "lavtudo_admin_create_history" on public.lavtudo_wash_history;
drop policy if exists "lavtudo_admin_delete_history" on public.lavtudo_wash_history;

create policy "lavtudo_machine_or_admin_read_machines"
on public.lavtudo_machines for select to anon
using (
  id = private.lavtudo_request_header('x-lavtudo-machine-id')
  or private.lavtudo_admin_ok(
    private.lavtudo_request_header('x-lavtudo-admin-user'),
    private.lavtudo_request_header('x-lavtudo-admin-password')
  )
);

create policy "lavtudo_machine_or_admin_read_washes"
on public.lavtudo_washes for select to anon
using (
  machine_id = private.lavtudo_request_header('x-lavtudo-machine-id')
  or private.lavtudo_admin_ok(
    private.lavtudo_request_header('x-lavtudo-admin-user'),
    private.lavtudo_request_header('x-lavtudo-admin-password')
  )
);

create policy "lavtudo_admin_create_washes"
on public.lavtudo_washes for insert to anon
with check (
  private.lavtudo_admin_ok(
    private.lavtudo_request_header('x-lavtudo-admin-user'),
    private.lavtudo_request_header('x-lavtudo-admin-password')
  )
);

create policy "lavtudo_admin_update_washes"
on public.lavtudo_washes for update to anon
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

create policy "lavtudo_machine_or_admin_read_history"
on public.lavtudo_wash_history for select to anon
using (
  exists (
    select 1 from public.lavtudo_washes as wash
    where wash.id = wash_id
      and (
        wash.machine_id = private.lavtudo_request_header('x-lavtudo-machine-id')
        or private.lavtudo_admin_ok(
          private.lavtudo_request_header('x-lavtudo-admin-user'),
          private.lavtudo_request_header('x-lavtudo-admin-password')
        )
      )
  )
);

create policy "lavtudo_admin_create_history"
on public.lavtudo_wash_history for insert to anon
with check (
  private.lavtudo_admin_ok(
    private.lavtudo_request_header('x-lavtudo-admin-user'),
    private.lavtudo_request_header('x-lavtudo-admin-password')
  )
);

create policy "lavtudo_admin_delete_history"
on public.lavtudo_wash_history for delete to anon
using (
  private.lavtudo_admin_ok(
    private.lavtudo_request_header('x-lavtudo-admin-user'),
    private.lavtudo_request_header('x-lavtudo-admin-password')
  )
);

create or replace function private.lavtudo_status_label(p_status text)
returns text language sql immutable security invoker set search_path = '' as $$
  select case p_status
    when 'waiting' then 'Aguardando início'
    when 'washing' then 'Lavagem em andamento'
    when 'rinsing' then 'Enxágue em andamento'
    when 'spinning' then 'Centrifugação em andamento'
    when 'drying' then 'Secagem em andamento'
    when 'ready' then 'Pronta para retirada'
    when 'collected' then 'Máquina liberada'
    when 'cancelled' then 'Operação cancelada'
  end;
$$;

create or replace function private.lavtudo_wash_json(p_id bigint)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'id', wash.id::text,
    'machineId', wash.machine_id,
    'machineLabel', wash.machine_label,
    'serviceType', wash.service_type,
    'status', wash.status,
    'estimatedMinutes', wash.estimated_minutes,
    'createdAt', wash.created_at,
    'updatedAt', wash.updated_at,
    'startedAt', wash.started_at,
    'readyAt', wash.ready_at,
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', history.id::text,
        'status', history.status,
        'label', history.label,
        'at', history.occurred_at,
        'actor', history.actor
      ) order by history.occurred_at, history.id)
      from public.lavtudo_wash_history as history
      where history.wash_id = wash.id
    ), '[]'::jsonb)
  )
  from public.lavtudo_washes as wash
  where wash.id = p_id;
$$;

create or replace function private.lavtudo_machine_json(p_id text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'id', machine.id,
    'label', machine.label,
    'kind', machine.kind,
    'position', machine.position,
    'currentWash', (
      select private.lavtudo_wash_json(wash.id)
      from public.lavtudo_washes as wash
      where wash.machine_id = machine.id
        and wash.status not in ('collected', 'cancelled')
      order by wash.created_at desc
      limit 1
    )
  )
  from public.lavtudo_machines as machine
  where machine.id = p_id;
$$;

create or replace function public.lavtudo_get_machine(p_id text)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  if p_id !~ '^(lavadora|secadora)-0[1-4]$' then return null; end if;
  return private.lavtudo_machine_json(p_id);
end;
$$;

create or replace function public.lavtudo_list_machines(p_user text, p_password text)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb;
begin
  if not private.lavtudo_admin_ok(p_user, p_password) then
    raise insufficient_privilege using message = 'Credenciais administrativas inválidas.';
  end if;
  select coalesce(jsonb_agg(private.lavtudo_machine_json(machine.id) order by machine.kind desc, machine.position), '[]'::jsonb)
  into result from public.lavtudo_machines as machine;
  return result;
end;
$$;

create or replace function public.lavtudo_start_machine_wash(
  p_user text,
  p_password text,
  p_machine_id text,
  p_service_type text,
  p_estimated_minutes integer,
  p_started_at timestamptz
)
returns jsonb language plpgsql volatile security invoker set search_path = '' as $$
declare
  machine_record public.lavtudo_machines%rowtype;
  created_wash_id bigint;
  initial_status text;
begin
  if not private.lavtudo_admin_ok(p_user, p_password) then
    raise insufficient_privilege using message = 'Credenciais administrativas inválidas.';
  end if;
  select * into machine_record from public.lavtudo_machines where id = p_machine_id;
  if not found then return null; end if;
  if p_estimated_minutes not between 5 and 240 then
    raise check_violation using message = 'Duração inválida.';
  end if;
  if machine_record.kind = 'dryer' and p_service_type <> 'drying' then
    raise check_violation using message = 'Serviço incompatível com a secadora.';
  end if;
  if machine_record.kind = 'washer' and p_service_type not in ('standard', 'delicate', 'heavy') then
    raise check_violation using message = 'Serviço incompatível com a lavadora.';
  end if;
  if exists (
    select 1 from public.lavtudo_washes
    where machine_id = p_machine_id and status not in ('collected', 'cancelled')
  ) then
    raise unique_violation using message = 'Máquina ocupada.';
  end if;

  initial_status := case when machine_record.kind = 'dryer' then 'drying' else 'washing' end;
  insert into public.lavtudo_washes (
    customer_name, machine_id, machine_label, service_type, status,
    estimated_minutes, created_at, updated_at, started_at
  ) values (
    'Cliente LavTudo', machine_record.id, machine_record.label, p_service_type, initial_status,
    p_estimated_minutes, p_started_at, p_started_at, p_started_at
  ) returning id into created_wash_id;

  insert into public.lavtudo_wash_history (wash_id, status, label, occurred_at, actor)
  values (created_wash_id, initial_status, private.lavtudo_status_label(initial_status), p_started_at, 'employee');
  return private.lavtudo_machine_json(p_machine_id);
end;
$$;

create or replace function public.lavtudo_set_machine_status(
  p_user text,
  p_password text,
  p_machine_id text,
  p_status text
)
returns jsonb language plpgsql volatile security invoker set search_path = '' as $$
declare
  target_wash_id bigint;
  previous_status text;
  machine_kind text;
  changed_at timestamptz := now();
begin
  if not private.lavtudo_admin_ok(p_user, p_password) then
    raise insufficient_privilege using message = 'Credenciais administrativas inválidas.';
  end if;
  select kind into machine_kind from public.lavtudo_machines where id = p_machine_id;
  if not found then return null; end if;
  if p_status not in ('washing', 'rinsing', 'spinning', 'drying', 'ready', 'cancelled') then
    raise check_violation using message = 'Status inválido.';
  end if;
  if machine_kind = 'washer' and p_status = 'drying' then
    raise check_violation using message = 'Status incompatível com a lavadora.';
  end if;
  if machine_kind = 'dryer' and p_status not in ('drying', 'ready', 'cancelled') then
    raise check_violation using message = 'Status incompatível com a secadora.';
  end if;

  select id, status into target_wash_id, previous_status
  from public.lavtudo_washes
  where machine_id = p_machine_id and status not in ('collected', 'cancelled')
  order by created_at desc limit 1 for update;
  if not found then return null; end if;
  if previous_status = p_status then return private.lavtudo_machine_json(p_machine_id); end if;

  update public.lavtudo_washes
  set status = p_status,
      updated_at = changed_at,
      ready_at = case when p_status = 'ready' then changed_at else null end
  where id = target_wash_id;
  insert into public.lavtudo_wash_history (wash_id, status, label, occurred_at, actor)
  values (target_wash_id, p_status, private.lavtudo_status_label(p_status), changed_at, 'employee');
  return private.lavtudo_machine_json(p_machine_id);
end;
$$;

create or replace function public.lavtudo_release_machine(
  p_user text,
  p_password text,
  p_machine_id text
)
returns jsonb language plpgsql volatile security invoker set search_path = '' as $$
declare
  target_wash_id bigint;
  changed_at timestamptz := now();
begin
  if not private.lavtudo_admin_ok(p_user, p_password) then
    raise insufficient_privilege using message = 'Credenciais administrativas inválidas.';
  end if;
  select id into target_wash_id from public.lavtudo_washes
  where machine_id = p_machine_id and status not in ('collected', 'cancelled')
  order by created_at desc limit 1 for update;
  if not found then return private.lavtudo_machine_json(p_machine_id); end if;
  update public.lavtudo_washes
  set status = 'collected', updated_at = changed_at, ready_at = coalesce(ready_at, changed_at)
  where id = target_wash_id;
  insert into public.lavtudo_wash_history (wash_id, status, label, occurred_at, actor)
  values (target_wash_id, 'collected', private.lavtudo_status_label('collected'), changed_at, 'employee');
  return private.lavtudo_machine_json(p_machine_id);
end;
$$;

grant usage on schema private to anon;
grant execute on function private.lavtudo_machine_json(text) to anon;
grant execute on function public.lavtudo_get_machine(text) to anon;
grant execute on function public.lavtudo_list_machines(text, text) to anon;
grant execute on function public.lavtudo_start_machine_wash(text, text, text, text, integer, timestamptz) to anon;
grant execute on function public.lavtudo_set_machine_status(text, text, text, text) to anon;
grant execute on function public.lavtudo_release_machine(text, text, text) to anon;

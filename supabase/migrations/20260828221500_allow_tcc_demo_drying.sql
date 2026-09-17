-- A Lavadora 01 é a máquina fixa do modo de demonstração do TCC. O painel
-- operacional continua oferecendo somente as etapas compatíveis com cada tipo;
-- esta exceção permite que o roteiro demonstrativo mostre também a secagem na
-- mesma URL permanente exibida no celular.
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

  select kind into machine_kind
  from public.lavtudo_machines
  where id = p_machine_id;
  if not found then return null; end if;

  if p_status not in ('washing', 'rinsing', 'spinning', 'drying', 'ready', 'cancelled') then
    raise check_violation using message = 'Status inválido.';
  end if;
  if machine_kind = 'washer' and p_status = 'drying' and p_machine_id <> 'lavadora-01' then
    raise check_violation using message = 'Status incompatível com a lavadora.';
  end if;
  if machine_kind = 'dryer' and p_status not in ('drying', 'ready', 'cancelled') then
    raise check_violation using message = 'Status incompatível com a secadora.';
  end if;

  select id, status into target_wash_id, previous_status
  from public.lavtudo_washes
  where machine_id = p_machine_id and status not in ('collected', 'cancelled')
  order by created_at desc
  limit 1
  for update;
  if not found then return null; end if;
  if previous_status = p_status then return private.lavtudo_machine_json(p_machine_id); end if;

  update public.lavtudo_washes
  set status = p_status,
      updated_at = changed_at,
      ready_at = case when p_status = 'ready' then changed_at else null end
  where id = target_wash_id;

  insert into public.lavtudo_wash_history (wash_id, status, label, occurred_at, actor)
  values (
    target_wash_id,
    p_status,
    private.lavtudo_status_label(p_status),
    changed_at,
    'employee'
  );

  return private.lavtudo_machine_json(p_machine_id);
end;
$$;

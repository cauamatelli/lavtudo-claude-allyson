-- Adiciona a "Lavadora Pet": uma quinta lavadora, dedicada a roupas e itens de
-- pet (camas, cobertores, panos), com todas as funções já usadas pelas demais
-- lavadoras (mesmos serviços, mesmo painel administrativo, mesmo acompanhamento
-- por QR Code/NFC em URL permanente).

-- 1) Permite o novo id fixo "lavadora-pet" e a 5ª posição para lavadoras.
alter table public.lavtudo_machines
  drop constraint if exists lavtudo_machines_id_check;
alter table public.lavtudo_machines
  add constraint lavtudo_machines_id_check
  check (id ~ '^(lavadora|secadora)-0[1-4]$' or id = 'lavadora-pet');

alter table public.lavtudo_machines
  drop constraint if exists lavtudo_machines_position_check;
alter table public.lavtudo_machines
  add constraint lavtudo_machines_position_check
  check (position between 1 and 5);

-- 2) Cadastra a máquina permanentemente, igual às demais.
insert into public.lavtudo_machines (id, label, kind, position) values
  ('lavadora-pet', 'Lavadora Pet', 'washer', 5)
on conflict (id) do update set
  label = excluded.label,
  kind = excluded.kind,
  position = excluded.position;

-- 3) A função pública de consulta usava uma regex fixa para validar o id
-- recebido; passa a aceitar também "lavadora-pet".
create or replace function public.lavtudo_get_machine(p_id text)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  if p_id !~ '^(lavadora|secadora)-0[1-4]$' and p_id <> 'lavadora-pet' then
    return null;
  end if;
  return private.lavtudo_machine_json(p_id);
end;
$$;

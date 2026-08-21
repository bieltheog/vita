create table if not exists public.loan_topups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  loan_id uuid not null references public.loans(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  calculation_type text not null check (calculation_type in ('percentage','fixed')),
  return_value numeric(14,4) not null default 0 check (return_value >= 0),
  expected_profit numeric(14,2) not null check (expected_profit >= 0),
  total_receivable_added numeric(14,2) not null check (total_receivable_added >= amount),
  topup_date date not null,
  previous_remaining numeric(14,2) not null check (previous_remaining >= 0),
  new_remaining numeric(14,2) not null check (new_remaining >= 0),
  future_installment_count integer not null check (future_installment_count > 0),
  payment_frequency text not null check (payment_frequency in ('UNICO','DIARIO','SEMANAL','QUINZENAL','MENSAL','DATAS_FIXAS')),
  first_due_date date not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists loan_topups_user_date_idx on public.loan_topups(user_id, topup_date desc);
create index if not exists loan_topups_loan_idx on public.loan_topups(loan_id);

alter table public.loan_topups enable row level security;
drop policy if exists loan_topups_select_own on public.loan_topups;
create policy loan_topups_select_own on public.loan_topups for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists loan_topups_insert_own on public.loan_topups;
create policy loan_topups_insert_own on public.loan_topups for insert to authenticated with check ((select auth.uid()) = user_id);

grant select, insert on public.loan_topups to authenticated;

create or replace function public.add_loan_topup(
  p_loan_id uuid,
  p_amount numeric,
  p_calculation_type text,
  p_return_value numeric,
  p_topup_date date,
  p_payment_frequency text,
  p_future_installment_count integer,
  p_first_due_date date,
  p_daily_off_days smallint[],
  p_due_dates date[],
  p_remaining_values numeric[],
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_loan public.loans%rowtype;
  v_old_remaining numeric(14,2);
  v_profit numeric(14,2);
  v_added_total numeric(14,2);
  v_new_remaining numeric(14,2);
  v_sum numeric(14,2);
  v_topup_id uuid;
  v_max_locked integer;
  v_i integer;
begin
  if v_uid is null then raise exception 'Sessão inválida.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Informe um valor adicional maior que zero.'; end if;
  if p_calculation_type not in ('percentage','fixed') then raise exception 'Tipo de cálculo inválido.'; end if;
  if coalesce(p_return_value,0) < 0 then raise exception 'O retorno não pode ser negativo.'; end if;
  if p_topup_date is null or p_topup_date > (now() at time zone 'America/Sao_Paulo')::date then raise exception 'A data do adicional não pode estar no futuro.'; end if;
  if p_payment_frequency not in ('UNICO','DIARIO','SEMANAL','QUINZENAL','MENSAL','DATAS_FIXAS') then raise exception 'Forma de pagamento inválida.'; end if;
  if p_future_installment_count is null or p_future_installment_count <= 0 then raise exception 'Informe a quantidade de parcelas futuras.'; end if;
  if p_first_due_date is null then raise exception 'Informe o primeiro vencimento.'; end if;
  if p_payment_frequency = 'DIARIO' and coalesce(cardinality(p_daily_off_days),0) >= 7 then raise exception 'Escolha pelo menos um dia da semana com cobrança.'; end if;
  if cardinality(p_due_dates) <> p_future_installment_count or cardinality(p_remaining_values) <> p_future_installment_count then raise exception 'O calendário futuro está incompleto.'; end if;

  select * into v_loan from public.loans where id = p_loan_id and user_id = v_uid for update;
  if not found then raise exception 'Empréstimo não encontrado.'; end if;
  if v_loan.status = 'CANCELADO' then raise exception 'Não é possível adicionar valor a um empréstimo cancelado.'; end if;

  select coalesce(sum(remaining_amount),0)::numeric(14,2) into v_old_remaining
  from public.installments where loan_id = p_loan_id and user_id = v_uid and stored_status <> 'CANCELADO';

  v_profit := case when p_calculation_type = 'percentage' then round(p_amount * coalesce(p_return_value,0) / 100, 2) else round(coalesce(p_return_value,0), 2) end;
  v_added_total := round(p_amount + v_profit, 2);
  v_new_remaining := round(v_old_remaining + v_added_total, 2);

  select round(coalesce(sum(x),0),2)::numeric(14,2) into v_sum from unnest(p_remaining_values) as x;
  if v_sum <> v_new_remaining then raise exception 'A soma das novas parcelas precisa ser igual ao novo saldo de R$ %.', replace(v_new_remaining::text,'.',','); end if;

  for v_i in 1..p_future_installment_count loop
    if p_due_dates[v_i] is null or p_remaining_values[v_i] is null or p_remaining_values[v_i] <= 0 then raise exception 'Confira a data e o valor da parcela futura %.', v_i; end if;
    if v_i > 1 and p_due_dates[v_i] <= p_due_dates[v_i-1] then raise exception 'As datas futuras devem estar em ordem crescente e não podem se repetir.'; end if;
  end loop;

  insert into public.loan_topups(user_id,loan_id,client_id,amount,calculation_type,return_value,expected_profit,total_receivable_added,topup_date,previous_remaining,new_remaining,future_installment_count,payment_frequency,first_due_date,notes)
  values(v_uid,p_loan_id,v_loan.client_id,round(p_amount,2),p_calculation_type,coalesce(p_return_value,0),v_profit,v_added_total,p_topup_date,v_old_remaining,v_new_remaining,p_future_installment_count,p_payment_frequency,p_first_due_date,nullif(trim(coalesce(p_notes,'')),''))
  returning id into v_topup_id;

  delete from public.installments i
  where i.loan_id = p_loan_id and i.user_id = v_uid
    and not exists (select 1 from public.payments p where p.installment_id = i.id);

  update public.installments i
  set remaining_amount = 0,
      stored_status = case when i.remaining_amount > 0 then 'CANCELADO' else i.stored_status end,
      updated_at = now()
  where i.loan_id = p_loan_id and i.user_id = v_uid
    and exists (select 1 from public.payments p where p.installment_id = i.id)
    and i.remaining_amount > 0;

  select coalesce(max(installment_number),0) into v_max_locked
  from public.installments where loan_id = p_loan_id and user_id = v_uid;

  for v_i in 1..p_future_installment_count loop
    insert into public.installments(user_id,loan_id,client_id,installment_number,due_date,original_due_date,amount,amount_paid,remaining_amount,stored_status)
    values(v_uid,p_loan_id,v_loan.client_id,v_max_locked+v_i,p_due_dates[v_i],p_due_dates[v_i],round(p_remaining_values[v_i],2),0,round(p_remaining_values[v_i],2),case when p_due_dates[v_i] < (now() at time zone 'America/Sao_Paulo')::date then 'ATRASADO' else 'PENDENTE' end);
  end loop;

  update public.loans
  set principal_amount = round(principal_amount + p_amount,2),
      expected_profit = round(expected_profit + v_profit,2),
      total_receivable = round(total_receivable + v_added_total,2),
      payment_frequency = p_payment_frequency,
      installment_count = v_max_locked + p_future_installment_count,
      first_due_date = p_first_due_date,
      daily_off_days = coalesce(p_daily_off_days,'{}'::smallint[]),
      fixed_schedule = '{}'::jsonb,
      status = 'ATIVO',
      updated_at = now()
  where id = p_loan_id and user_id = v_uid;

  insert into public.activity_logs(user_id,entity_type,entity_id,action,old_data,new_data,description)
  values(v_uid,'loan',p_loan_id,'capital_added',jsonb_build_object('principal_amount',v_loan.principal_amount,'expected_profit',v_loan.expected_profit,'total_receivable',v_loan.total_receivable,'remaining',v_old_remaining),jsonb_build_object('topup_id',v_topup_id,'additional_principal',round(p_amount,2),'additional_profit',v_profit,'added_receivable',v_added_total,'new_remaining',v_new_remaining,'future_installments',p_future_installment_count,'frequency',p_payment_frequency),format('Adicional de R$ %s registrado no empréstimo %s. Saldo futuro reorganizado sem apagar pagamentos anteriores.',replace(round(p_amount,2)::text,'.',','),v_loan.loan_code));

  return v_topup_id;
end;
$$;

revoke all on function public.add_loan_topup(uuid,numeric,text,numeric,date,text,integer,date,smallint[],date[],numeric[],text) from public, anon;
grant execute on function public.add_loan_topup(uuid,numeric,text,numeric,date,text,integer,date,smallint[],date[],numeric[],text) to authenticated;

create or replace function private.sync_installment_after_payment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_id uuid;
  owner_id uuid;
  paid numeric(14,2);
  total numeric(14,2);
  due date;
  current_status text;
begin
  target_id := coalesce(new.installment_id, old.installment_id);
  if target_id is null then return coalesce(new, old); end if;
  select user_id, amount, due_date, stored_status into owner_id, total, due, current_status from public.installments where id = target_id;
  if coalesce(new.user_id, old.user_id) is distinct from owner_id then raise exception 'Usuário do pagamento não corresponde ao proprietário da parcela'; end if;
  select coalesce(sum(amount), 0) into paid from public.payments where installment_id = target_id and voided_at is null;
  if paid > total then raise exception 'Pagamentos excedem o valor da parcela'; end if;
  update public.installments
  set amount_paid = paid,
      remaining_amount = case when current_status = 'CANCELADO' then 0 else greatest(total - paid, 0) end,
      stored_status = case when current_status = 'CANCELADO' then 'CANCELADO' when paid >= total then 'PAGO' when paid > 0 then 'PARCIAL' when due < (now() at time zone 'America/Sao_Paulo')::date then 'ATRASADO' when current_status = 'REAGENDADO' then 'REAGENDADO' else 'PENDENTE' end,
      paid_at = case when current_status <> 'CANCELADO' and paid >= total then now() else null end,
      updated_at = now()
  where id = target_id and user_id = owner_id;
  return coalesce(new, old);
end;
$$;
revoke all on function private.sync_installment_after_payment() from public, anon, authenticated;

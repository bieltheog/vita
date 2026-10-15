-- Duas carteiras sem reset, sem exclusão e sem mover lançamentos antigos.
-- A carteira 1 recebe os contratos já existentes; a 2 começa sem empréstimos.
alter table public.loans
  add column if not exists portfolio_id smallint not null default 1
  check (portfolio_id in (1, 2));
create index if not exists loans_user_portfolio_idx on public.loans(user_id, portfolio_id);

-- Identificador explícito em entradas do caixa antigo para preservar a carteira 1.
alter table public.cash_entries add column if not exists portfolio_id smallint not null default 1
  check (portfolio_id in (1,2));
alter table public.cash_debts add column if not exists portfolio_id smallint not null default 1
  check (portfolio_id in (1,2));

-- Lançamentos administrativos que não são pagamentos de clientes:
-- recebimentos dos clientes continuam sendo registrados exclusivamente em payments.
create table if not exists public.portfolio_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id smallint not null check (portfolio_id in (1,2)),
  kind text not null check (kind in ('APORTE','CREDITO','AMORTIZACAO_DIVIDA','JUROS_FINANCIAMENTO','RETIRADA','DESPESA','PERDA','RECUPERACAO')),
  amount numeric(14,2) not null check (amount > 0),
  entry_date date not null,
  description text not null,
  loan_id uuid references public.loans(id) on delete restrict,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  void_reason text,
  constraint portfolio_entries_loss_link check (kind not in ('PERDA','RECUPERACAO') or loan_id is not null)
);
create index if not exists portfolio_entries_owner_period_idx
  on public.portfolio_entries (user_id,portfolio_id,entry_date desc);
alter table public.portfolio_entries enable row level security;
create policy portfolio_entries_select_own on public.portfolio_entries
  for select to authenticated using (user_id=(select auth.uid()));
create policy portfolio_entries_insert_own on public.portfolio_entries
  for insert to authenticated with check (
    user_id=(select auth.uid()) and
    (loan_id is null or exists (
      select 1 from public.loans l
      where l.id=loan_id and l.user_id=(select auth.uid()) and l.portfolio_id=portfolio_id
    ))
  );
create policy portfolio_entries_update_own on public.portfolio_entries
  for update to authenticated using (user_id=(select auth.uid()))
  with check (
    user_id=(select auth.uid()) and
    (loan_id is null or exists (
      select 1 from public.loans l
      where l.id=loan_id and l.user_id=(select auth.uid()) and l.portfolio_id=portfolio_id
    ))
  );
grant select,insert,update on public.portfolio_entries to authenticated;

-- Classificação inequívoca para que o juros recebido não amortize o principal.
alter table public.payments add column if not exists payment_kind text not null default 'NORMAL'
  check (payment_kind in ('NORMAL','JUROS'));

-- Classificação de principal e juros preservada no instante do pagamento.
-- Pagamentos históricos anteriores à migração ficam sem componentes retroativos.
alter table public.payments add column if not exists principal_component numeric(14,2);
alter table public.payments add column if not exists interest_component numeric(14,2);
alter table public.payments add constraint payment_components_nonnegative
  check ((principal_component is null or principal_component >= 0)
     and (interest_component is null or interest_component >= 0));

create or replace function private.classify_portfolio_payment()
returns trigger language plpgsql security invoker set search_path=public as $$
declare
  v_portfolio smallint;
  v_principal numeric(14,2);
  v_principal_paid numeric(14,2);
  v_receivable numeric(14,2);
  v_left numeric(14,2);
begin
  select portfolio_id,principal_amount into v_portfolio,v_principal
    from public.loans where id=new.loan_id and user_id=new.user_id;
  if v_portfolio is null then raise exception 'Empréstimo inválido para o proprietário'; end if;
  if new.payment_kind='JUROS' then
    new.principal_component:=0;
    new.interest_component:=new.amount;
  elsif v_portfolio=2 then
    select coalesce(sum(principal_component),0) into v_principal_paid
      from public.payments where loan_id=new.loan_id and user_id=new.user_id
      and voided_at is null and principal_component is not null;
    v_left:=greatest(v_principal-v_principal_paid,0);
    select coalesce(sum(remaining_amount),0) into v_receivable
      from public.installments where loan_id=new.loan_id and user_id=new.user_id
      and stored_status<>'CANCELADO';
    if v_receivable<=0 then raise exception 'Empréstimo sem saldo a receber'; end if;
    new.principal_component:=least(new.amount,round(new.amount*(v_left/v_receivable),2));
    new.interest_component:=new.amount-new.principal_component;
  else
    -- Carteira 1: não reclassificar pagamentos legados.
    new.principal_component:=null;
    new.interest_component:=null;
  end if;
  return new;
end; $$;

drop trigger if exists portfolio_classify_payment on public.payments;
create trigger portfolio_classify_payment before insert on public.payments
for each row execute function private.classify_portfolio_payment();

create table if not exists public.interest_rollovers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  loan_id uuid not null references public.loans(id) on delete restrict,
  original_installment_id uuid not null references public.installments(id) on delete restrict,
  next_installment_id uuid not null unique references public.installments(id) on delete restrict,
  payment_id uuid not null unique references public.payments(id) on delete restrict,
  interest_amount numeric(14,2) not null check (interest_amount>0),
  original_amount numeric(14,2) not null check (original_amount>0),
  created_at timestamptz not null default now()
);
alter table public.interest_rollovers enable row level security;
create policy interest_rollovers_select_own on public.interest_rollovers
  for select to authenticated using (user_id=(select auth.uid()));
create policy interest_rollovers_insert_own on public.interest_rollovers
  for insert to authenticated with check (
    user_id=(select auth.uid()) and exists (
      select 1 from public.loans l where l.id=loan_id and l.user_id=(select auth.uid())
    ) and exists (
      select 1 from public.payments p where p.id=payment_id and p.user_id=(select auth.uid())
    )
  );
grant select,insert on public.interest_rollovers to authenticated;

-- Transação atômica: marca o juro como quitado e renova o MESMO capital
-- para o mês seguinte, mantendo todo o histórico. Restrita a contratos
-- de parcela única e ainda não parcialmente pagos.
create or replace function public.register_interest_only_payment(
  p_installment_id uuid,
  p_payment_date date,
  p_payment_method text default 'PIX',
  p_notes text default null
) returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_inst public.installments%rowtype;
  v_loan public.loans%rowtype;
  v_interest numeric(14,2);
  v_next_id uuid;
  v_payment_id uuid;
  v_new_date date;
  v_next_number integer;
  v_open_count integer;
begin
  if v_user is null then raise exception 'Sessão inválida'; end if;
  if p_payment_date is null then raise exception 'Informe a data do pagamento'; end if;
  if p_payment_method not in ('PIX','DINHEIRO','TRANSFERENCIA','OUTRO') then
    raise exception 'Método de pagamento inválido';
  end if;
  select * into v_inst from public.installments
    where id=p_installment_id and user_id=v_user for update;
  if not found then raise exception 'Parcela não encontrada'; end if;
  select * into v_loan from public.loans
    where id=v_inst.loan_id and user_id=v_user for update;
  if not found or v_loan.status<>'ATIVO' then
    raise exception 'O empréstimo precisa estar ativo';
  end if;
  if v_loan.payment_frequency not in ('UNICO','MENSAL') then
    raise exception 'Pagamento somente de juros está disponível para operações mensais de parcela única';
  end if;
  select count(*) into v_open_count from public.installments
    where loan_id=v_loan.id and stored_status<>'CANCELADO' and remaining_amount>0.005;
  if v_open_count<>1 or v_inst.amount_paid<>0 or
    abs(v_inst.remaining_amount-v_inst.amount)>0.005 then
    raise exception 'Esta operação possui parcelas múltiplas ou pagamento parcial; revise manualmente';
  end if;
  v_interest := round(coalesce(v_loan.fixed_return_amount,
                     v_loan.principal_amount * coalesce(v_loan.return_percentage,0)/100),2);
  if v_interest<=0 or abs(v_inst.amount-(v_loan.principal_amount+v_interest))>0.01 then
    raise exception 'Valor da parcela não corresponde ao principal mais um ciclo de juros; revise o contrato';
  end if;
  v_new_date := (greatest(v_inst.due_date,p_payment_date)+interval '1 month')::date;
  select coalesce(max(installment_number),0)+1 into v_next_number
    from public.installments where loan_id=v_loan.id;

  -- Agendar PRIMEIRO a parcela seguinte evita que o trigger de quitação
  -- finalize o empréstimo quando os juros atuais forem pagos.
  insert into public.installments(user_id,loan_id,client_id,installment_number,
      due_date,original_due_date,amount,amount_paid,remaining_amount,stored_status)
  values(v_user,v_loan.id,v_loan.client_id,v_next_number,
      v_new_date,v_new_date,v_loan.principal_amount+v_interest,0,
      v_loan.principal_amount+v_interest,'PENDENTE')
  returning id into v_next_id;

  -- O pagamento cobriu os juros deste mês, nunca o principal.
  update public.installments set amount=v_interest,
    remaining_amount=v_interest,updated_at=now()
    where id=v_inst.id and user_id=v_user;

  insert into public.payments(user_id,client_id,loan_id,installment_id,
                              amount,payment_date,payment_method,notes,payment_kind)
  values(v_user,v_loan.client_id,v_loan.id,v_inst.id,v_interest,
    p_payment_date,p_payment_method,
    concat('[JUROS] ',coalesce(p_notes,'')),'JUROS')
  returning id into v_payment_id;

  update public.loans set installment_count=v_next_number,
    total_receivable=total_receivable+v_interest,
    expected_profit=expected_profit+v_interest,
    updated_at=now() where id=v_loan.id and user_id=v_user;

  insert into public.interest_rollovers(user_id,loan_id,original_installment_id,
      next_installment_id,payment_id,interest_amount,original_amount)
  values(v_user,v_loan.id,v_inst.id,v_next_id,v_payment_id,v_interest,v_inst.amount);

  insert into public.activity_logs(user_id,entity_type,entity_id,action,old_data,new_data,description)
  values(v_user,'loan',v_loan.id,'interest_only_payment',
    jsonb_build_object('installment_id',v_inst.id,'amount',v_inst.amount),
    jsonb_build_object('payment_id',v_payment_id,'next_installment_id',v_next_id,
                       'next_due_date',v_new_date,'interest',v_interest,
                       'principal_unchanged',v_loan.principal_amount),
    format('Apenas juros recebidos (%s). Principal %s mantido; novo vencimento %s.',
      v_interest,v_loan.principal_amount,v_new_date));

  return jsonb_build_object('ok',true,'loan_id',v_loan.id,
      'client_id',v_loan.client_id,'interest',v_interest,
      'next_due_date',v_new_date,'next_installment_id',v_next_id);
end;
$$;
revoke all on function public.register_interest_only_payment(uuid,date,text,text) from public, anon;
grant execute on function public.register_interest_only_payment(uuid,date,text,text) to authenticated;

-- Impede que o estorno genérico desmonte o principal sem ajustar o rollover.
create or replace function private.guard_interest_rollover_void()
returns trigger language plpgsql set search_path=public as $$
begin
  if old.payment_kind='JUROS' and
    (new.voided_at is distinct from old.voided_at or new.amount is distinct from old.amount)
  then
    raise exception 'Pagamento somente de juros possui renovação vinculada; não é possível alterá-lo pelo estorno comum';
  end if;
  return new;
end;
$$;
drop trigger if exists interest_rollover_void_guard on public.payments;
create trigger interest_rollover_void_guard before update on public.payments
for each row execute function private.guard_interest_rollover_void();

-- Estorno atômico do fluxo "somente juros".
-- Preserva o pagamento e a parcela gerada no histórico, mas os marca como estornados/cancelados.

create or replace function private.guard_interest_rollover_void()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
begin
  if old.payment_kind='JUROS'
     and (new.voided_at is distinct from old.voided_at or new.amount is distinct from old.amount)
     and coalesce(current_setting('app.allow_interest_rollback', true),'') <> '1'
  then
    raise exception 'Pagamento somente de juros possui renovação vinculada; use a ação Estornar juros.';
  end if;
  return new;
end;
$$;

-- Corrige a validação dos vínculos da política original: cada parcela precisa
-- pertencer ao mesmo empréstimo registrado no rollover.
drop policy if exists interest_rollovers_insert_own on public.interest_rollovers;
create policy interest_rollovers_insert_own on public.interest_rollovers
  for insert to authenticated
  with check (
    user_id=(select auth.uid())
    and exists (
      select 1 from public.loans l
      where l.id=interest_rollovers.loan_id
        and l.user_id=(select auth.uid())
    )
    and exists (
      select 1 from public.payments p
      where p.id=interest_rollovers.payment_id
        and p.loan_id=interest_rollovers.loan_id
        and p.user_id=(select auth.uid())
    )
    and exists (
      select 1 from public.installments oi
      where oi.id=interest_rollovers.original_installment_id
        and oi.loan_id=interest_rollovers.loan_id
        and oi.user_id=(select auth.uid())
    )
    and exists (
      select 1 from public.installments ni
      where ni.id=interest_rollovers.next_installment_id
        and ni.loan_id=interest_rollovers.loan_id
        and ni.user_id=(select auth.uid())
    )
  );

create or replace function public.void_interest_only_payment(
  p_payment_id uuid,
  p_reason text default null
) returns jsonb
language plpgsql
security invoker
set search_path=public,private
as $$
declare
  v_user uuid := auth.uid();
  v_payment public.payments%rowtype;
  v_rollover public.interest_rollovers%rowtype;
  v_original public.installments%rowtype;
  v_next public.installments%rowtype;
  v_loan public.loans%rowtype;
  v_next_active_payments integer;
  v_open_count integer;
  v_operational_count integer;
  v_restored_status text;
  v_reason text := nullif(trim(coalesce(p_reason,'')),'');
begin
  if v_user is null then raise exception 'Sessão inválida'; end if;

  select * into v_payment
  from public.payments
  where id=p_payment_id
    and user_id=v_user
    and payment_kind='JUROS'
    and voided_at is null
  for update;
  if not found then raise exception 'Pagamento de juros ativo não encontrado'; end if;

  select * into v_rollover
  from public.interest_rollovers
  where payment_id=v_payment.id
    and user_id=v_user;
  if not found then raise exception 'A renovação vinculada a este pagamento não foi encontrada'; end if;

  select * into v_original
  from public.installments
  where id=v_rollover.original_installment_id
    and loan_id=v_rollover.loan_id
    and user_id=v_user
  for update;
  if not found then raise exception 'Parcela original não encontrada'; end if;

  select * into v_next
  from public.installments
  where id=v_rollover.next_installment_id
    and loan_id=v_rollover.loan_id
    and user_id=v_user
  for update;
  if not found then raise exception 'Parcela gerada pela renovação não encontrada'; end if;

  select * into v_loan
  from public.loans
  where id=v_rollover.loan_id
    and user_id=v_user
  for update;
  if not found then raise exception 'Empréstimo não encontrado'; end if;

  select count(*) into v_next_active_payments
  from public.payments
  where installment_id=v_next.id
    and user_id=v_user
    and voided_at is null;

  if v_next_active_payments>0 or v_next.amount_paid>0.005 then
    raise exception 'Não é possível estornar os juros porque a parcela gerada já recebeu pagamento. Desfaça primeiro as movimentações posteriores.';
  end if;

  if v_next.stored_status='CANCELADO' then
    raise exception 'A parcela gerada pela renovação já foi alterada ou cancelada. Revise o calendário antes de estornar.';
  end if;

  if abs(v_next.amount-v_rollover.original_amount)>0.01 then
    raise exception 'A parcela gerada teve o valor alterado depois da renovação. Revise a alteração antes de estornar.';
  end if;

  select count(*) into v_open_count
  from public.installments
  where loan_id=v_loan.id
    and user_id=v_user
    and stored_status<>'CANCELADO'
    and remaining_amount>0.005;

  if v_open_count<>1 or v_next.remaining_amount<=0.005 then
    raise exception 'Existem alterações posteriores no calendário deste empréstimo. O estorno automático foi bloqueado para preservar o histórico.';
  end if;

  update public.installments
  set remaining_amount=0,
      stored_status='CANCELADO',
      paid_at=null,
      updated_at=now()
  where id=v_next.id and user_id=v_user;

  perform set_config('app.allow_interest_rollback','1',true);

  update public.payments
  set voided_at=now(),
      void_reason=coalesce(v_reason,'Estorno de pagamento somente de juros')
  where id=v_payment.id and user_id=v_user and voided_at is null;

  v_restored_status := case
    when v_original.due_date < (now() at time zone 'America/Sao_Paulo')::date then 'ATRASADO'
    when v_original.due_date <> v_original.original_due_date then 'REAGENDADO'
    else 'PENDENTE'
  end;

  update public.installments
  set amount=v_rollover.original_amount,
      amount_paid=0,
      remaining_amount=v_rollover.original_amount,
      stored_status=v_restored_status,
      paid_at=null,
      updated_at=now()
  where id=v_original.id and user_id=v_user;

  select count(*) into v_operational_count
  from public.installments
  where loan_id=v_loan.id
    and user_id=v_user
    and stored_status<>'CANCELADO';

  update public.loans
  set total_receivable=greatest(principal_amount,total_receivable-v_rollover.interest_amount),
      expected_profit=greatest(0,expected_profit-v_rollover.interest_amount),
      installment_count=greatest(1,v_operational_count),
      status='ATIVO',
      updated_at=now()
  where id=v_loan.id and user_id=v_user;

  insert into public.activity_logs(
    user_id,entity_type,entity_id,action,old_data,new_data,description
  ) values (
    v_user,'loan',v_loan.id,'interest_only_payment_voided',
    jsonb_build_object(
      'payment_id',v_payment.id,
      'interest',v_rollover.interest_amount,
      'generated_installment_id',v_next.id
    ),
    jsonb_build_object(
      'original_installment_id',v_original.id,
      'restored_amount',v_rollover.original_amount,
      'restored_status',v_restored_status,
      'generated_installment_status','CANCELADO'
    ),
    format(
      'Pagamento somente de juros de %s estornado. Parcela original restaurada para %s e renovação cancelada.',
      v_rollover.interest_amount,
      v_rollover.original_amount
    )
  );

  return jsonb_build_object(
    'ok',true,
    'loan_id',v_loan.id,
    'client_id',v_loan.client_id,
    'original_installment_id',v_original.id,
    'cancelled_installment_id',v_next.id,
    'voided_payment_id',v_payment.id,
    'restored_amount',v_rollover.original_amount
  );
end;
$$;

revoke all on function public.void_interest_only_payment(uuid,text) from public,anon;
grant execute on function public.void_interest_only_payment(uuid,text) to authenticated;

create index if not exists interest_rollovers_user_idx
  on public.interest_rollovers(user_id);
create index if not exists interest_rollovers_loan_idx
  on public.interest_rollovers(loan_id);
create index if not exists interest_rollovers_original_installment_idx
  on public.interest_rollovers(original_installment_id);

-- Mantém o status do empréstimo sincronizado quando a última parcela é quitada.
-- A função roda somente como trigger interno e nunca altera pagamentos existentes.
create or replace function private.finalize_loan_when_paid()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  finalized_code text;
begin
  if new.stored_status = 'CANCELADO' or new.remaining_amount > 0.005 then
    return new;
  end if;

  update public.loans as loan
  set status = 'FINALIZADO',
      updated_at = now()
  where loan.id = new.loan_id
    and loan.user_id = new.user_id
    and loan.status = 'ATIVO'
    and not exists (
      select 1
      from public.installments as installment
      where installment.loan_id = new.loan_id
        and installment.user_id = new.user_id
        and installment.stored_status <> 'CANCELADO'
        and installment.remaining_amount > 0.005
    )
  returning loan.loan_code into finalized_code;

  if finalized_code is not null then
    insert into public.activity_logs (
      user_id,
      entity_type,
      entity_id,
      action,
      old_data,
      new_data,
      description
    ) values (
      new.user_id,
      'loan',
      new.loan_id,
      'auto_finalized',
      jsonb_build_object('status', 'ATIVO'),
      jsonb_build_object('status', 'FINALIZADO', 'reason', 'saldo quitado'),
      format('Empréstimo %s finalizado automaticamente após quitação.', finalized_code)
    );
  end if;

  return new;
end;
$$;

revoke all on function private.finalize_loan_when_paid() from public, anon, authenticated;

drop trigger if exists installments_finalize_paid_loan on public.installments;
create trigger installments_finalize_paid_loan
  after update of remaining_amount, stored_status on public.installments
  for each row
  when (new.stored_status <> 'CANCELADO' and new.remaining_amount <= 0.005)
  execute function private.finalize_loan_when_paid();

-- Corrige operações históricas já quitadas que ficaram com status ATIVO.
with finalized_loans as (
  update public.loans as loan
  set status = 'FINALIZADO',
      updated_at = now()
  where loan.status = 'ATIVO'
    and exists (
      select 1
      from public.installments as installment
      where installment.loan_id = loan.id
        and installment.user_id = loan.user_id
        and installment.stored_status <> 'CANCELADO'
    )
    and not exists (
      select 1
      from public.installments as installment
      where installment.loan_id = loan.id
        and installment.user_id = loan.user_id
        and installment.stored_status <> 'CANCELADO'
        and installment.remaining_amount > 0.005
    )
  returning loan.id, loan.user_id, loan.loan_code
)
insert into public.activity_logs (
  user_id,
  entity_type,
  entity_id,
  action,
  old_data,
  new_data,
  description
)
select
  user_id,
  'loan',
  id,
  'auto_finalized',
  jsonb_build_object('status', 'ATIVO'),
  jsonb_build_object('status', 'FINALIZADO', 'reason', 'saldo quitado'),
  format('Empréstimo %s finalizado automaticamente após confirmação da quitação.', loan_code)
from finalized_loans;

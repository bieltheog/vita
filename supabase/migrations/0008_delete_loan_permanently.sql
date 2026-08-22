create or replace function public.delete_loan_permanently(
  p_loan_id uuid,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_loan public.loans%rowtype;
  v_payment_count integer := 0;
  v_active_payment_count integer := 0;
  v_installment_ids uuid[] := '{}'::uuid[];
  v_payment_ids uuid[] := '{}'::uuid[];
  v_topup_ids uuid[] := '{}'::uuid[];
begin
  if v_uid is null then raise exception 'Sessão inválida.'; end if;

  select * into v_loan
  from public.loans
  where id = p_loan_id and user_id = v_uid
  for update;
  if not found then raise exception 'Empréstimo não encontrado.'; end if;

  if trim(coalesce(p_confirmation, '')) <> v_loan.loan_code then
    raise exception 'Digite exatamente % para confirmar a exclusão.', v_loan.loan_code;
  end if;

  select coalesce(array_agg(id), '{}'::uuid[]) into v_installment_ids
  from public.installments where loan_id = p_loan_id and user_id = v_uid;

  select coalesce(array_agg(id), '{}'::uuid[]), count(*), count(*) filter (where voided_at is null)
    into v_payment_ids, v_payment_count, v_active_payment_count
  from public.payments where loan_id = p_loan_id and user_id = v_uid;

  select coalesce(array_agg(id), '{}'::uuid[]) into v_topup_ids
  from public.loan_topups where loan_id = p_loan_id and user_id = v_uid;

  delete from public.notifications
  where user_id = v_uid and entity_id is not null and (
    entity_id = p_loan_id or entity_id = any(v_installment_ids)
    or entity_id = any(v_payment_ids) or entity_id = any(v_topup_ids)
  );

  delete from public.activity_logs
  where user_id = v_uid and entity_id is not null and (
    entity_id = p_loan_id or entity_id = any(v_installment_ids)
    or entity_id = any(v_payment_ids) or entity_id = any(v_topup_ids)
  );

  delete from public.payments where loan_id = p_loan_id and user_id = v_uid;
  delete from public.loans where id = p_loan_id and user_id = v_uid;

  insert into public.activity_logs(user_id, entity_type, entity_id, action, old_data, new_data, description)
  values(
    v_uid, 'loan_deleted', null, 'deleted_permanently',
    jsonb_build_object(
      'loan_id', v_loan.id, 'loan_code', v_loan.loan_code, 'client_id', v_loan.client_id,
      'principal_amount', v_loan.principal_amount, 'expected_profit', v_loan.expected_profit,
      'total_receivable', v_loan.total_receivable, 'payment_count', v_payment_count,
      'active_payment_count', v_active_payment_count
    ),
    null,
    format('Empréstimo %s excluído permanentemente. %s pagamento(s) vinculado(s) também foram removidos.', v_loan.loan_code, v_payment_count)
  );

  return jsonb_build_object(
    'loan_code', v_loan.loan_code,
    'payments_deleted', v_payment_count,
    'active_payments_deleted', v_active_payment_count
  );
end;
$$;

revoke all on function public.delete_loan_permanently(uuid,text) from public, anon;
grant execute on function public.delete_loan_permanently(uuid,text) to authenticated;

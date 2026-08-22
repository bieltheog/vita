create or replace function public.reschedule_paid_loan(
  p_loan_id uuid,
  p_payment_frequency text,
  p_future_installment_count integer,
  p_first_due_date date,
  p_daily_off_days smallint[],
  p_due_dates date[],
  p_future_values numeric[],
  p_status text default 'ATIVO'
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_loan public.loans%rowtype;
  v_current_remaining numeric(14,2);
  v_sum numeric(14,2);
  v_locked_max integer;
  v_i integer;
  v_has_payments boolean;
begin
  if v_uid is null then raise exception 'Sessão inválida.'; end if;
  if p_payment_frequency not in ('UNICO','DIARIO','SEMANAL','QUINZENAL','MENSAL','DATAS_FIXAS') then
    raise exception 'Forma de pagamento inválida.';
  end if;
  if p_status not in ('ATIVO','FINALIZADO','CANCELADO') then raise exception 'Status inválido.'; end if;
  if p_future_installment_count is null or p_future_installment_count <= 0 then
    raise exception 'Informe a quantidade de parcelas futuras.';
  end if;
  if p_first_due_date is null then raise exception 'Informe o primeiro vencimento.'; end if;
  if p_payment_frequency = 'DIARIO' and coalesce(cardinality(p_daily_off_days),0) >= 7 then
    raise exception 'Escolha pelo menos um dia da semana com cobrança.';
  end if;
  if cardinality(p_due_dates) <> p_future_installment_count or cardinality(p_future_values) <> p_future_installment_count then
    raise exception 'O novo calendário está incompleto.';
  end if;

  select * into v_loan
  from public.loans
  where id = p_loan_id and user_id = v_uid
  for update;
  if not found then raise exception 'Empréstimo não encontrado.'; end if;
  if v_loan.status = 'CANCELADO' then raise exception 'Não é possível reorganizar um empréstimo cancelado.'; end if;

  select exists(
    select 1
    from public.payments p
    where p.loan_id = p_loan_id and p.user_id = v_uid and p.voided_at is null
  ) into v_has_payments;
  if not v_has_payments then raise exception 'Este empréstimo ainda não possui pagamento ativo.'; end if;

  select coalesce(sum(i.remaining_amount),0)::numeric(14,2)
    into v_current_remaining
  from public.installments i
  where i.loan_id = p_loan_id
    and i.user_id = v_uid
    and i.stored_status <> 'CANCELADO';

  if v_current_remaining <= 0 then raise exception 'Este empréstimo não possui saldo pendente para reorganizar.'; end if;

  select round(coalesce(sum(x),0),2)::numeric(14,2)
    into v_sum
  from unnest(p_future_values) as x;
  if v_sum <> v_current_remaining then
    raise exception 'A soma das novas parcelas precisa ser igual ao saldo pendente de R$ %.', replace(v_current_remaining::text,'.',',');
  end if;

  for v_i in 1..p_future_installment_count loop
    if p_due_dates[v_i] is null or p_future_values[v_i] is null or p_future_values[v_i] <= 0 then
      raise exception 'Confira a data e o valor da parcela futura %.', v_i;
    end if;
    if v_i > 1 and p_due_dates[v_i] <= p_due_dates[v_i-1] then
      raise exception 'As datas futuras devem estar em ordem crescente e não podem se repetir.';
    end if;
  end loop;

  delete from public.installments i
  where i.loan_id = p_loan_id
    and i.user_id = v_uid
    and not exists (
      select 1 from public.payments p
      where p.installment_id = i.id
        and p.user_id = v_uid
        and p.voided_at is null
    );

  update public.installments i
  set remaining_amount = 0,
      stored_status = case when i.remaining_amount > 0 then 'CANCELADO' else i.stored_status end,
      updated_at = now()
  where i.loan_id = p_loan_id
    and i.user_id = v_uid
    and i.remaining_amount > 0
    and exists (
      select 1 from public.payments p
      where p.installment_id = i.id
        and p.user_id = v_uid
        and p.voided_at is null
    );

  select coalesce(max(i.installment_number),0)
    into v_locked_max
  from public.installments i
  where i.loan_id = p_loan_id and i.user_id = v_uid;

  for v_i in 1..p_future_installment_count loop
    insert into public.installments(
      user_id,loan_id,client_id,installment_number,due_date,original_due_date,
      amount,amount_paid,remaining_amount,stored_status
    ) values (
      v_uid,p_loan_id,v_loan.client_id,v_locked_max+v_i,p_due_dates[v_i],p_due_dates[v_i],
      round(p_future_values[v_i],2),0,round(p_future_values[v_i],2),
      case when p_due_dates[v_i] < (now() at time zone 'America/Sao_Paulo')::date then 'ATRASADO' else 'PENDENTE' end
    );
  end loop;

  update public.loans
  set payment_frequency = p_payment_frequency,
      installment_count = v_locked_max + p_future_installment_count,
      first_due_date = p_first_due_date,
      daily_off_days = coalesce(p_daily_off_days,'{}'::smallint[]),
      fixed_schedule = '{}'::jsonb,
      status = p_status,
      updated_at = now()
  where id = p_loan_id and user_id = v_uid;

  insert into public.activity_logs(user_id,entity_type,entity_id,action,old_data,new_data,description)
  values(
    v_uid,'loan',p_loan_id,'future_schedule_corrected',
    jsonb_build_object(
      'payment_frequency',v_loan.payment_frequency,
      'installment_count',v_loan.installment_count,
      'first_due_date',v_loan.first_due_date,
      'daily_off_days',v_loan.daily_off_days,
      'remaining',v_current_remaining
    ),
    jsonb_build_object(
      'payment_frequency',p_payment_frequency,
      'future_installments',p_future_installment_count,
      'first_due_date',p_first_due_date,
      'daily_off_days',coalesce(p_daily_off_days,'{}'::smallint[]),
      'remaining',v_current_remaining
    ),
    format('Calendário futuro do empréstimo %s corrigido para %s sem alterar pagamentos já registrados.',v_loan.loan_code,p_payment_frequency)
  );
end;
$$;

revoke all on function public.reschedule_paid_loan(uuid,text,integer,date,smallint[],date[],numeric[],text) from public, anon;
grant execute on function public.reschedule_paid_loan(uuid,text,integer,date,smallint[],date[],numeric[],text) to authenticated;

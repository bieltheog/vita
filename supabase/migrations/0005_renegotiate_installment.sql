create or replace function public.renegotiate_installment(
  p_installment_id uuid,
  p_new_due_date date,
  p_new_amount numeric,
  p_reason text default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_inst public.installments%rowtype;
  v_loan public.loans%rowtype;
  v_new_remaining numeric;
  v_new_total numeric;
  v_new_profit numeric;
  v_status text;
begin
  if v_user is null then raise exception 'Sessão inválida.'; end if;
  if p_new_due_date is null then raise exception 'Informe a nova data.'; end if;
  if p_new_amount is null or p_new_amount <= 0 then raise exception 'Informe um valor válido.'; end if;

  select * into v_inst from public.installments where id=p_installment_id and user_id=v_user for update;
  if not found then raise exception 'Parcela não encontrada.'; end if;
  select * into v_loan from public.loans where id=v_inst.loan_id and user_id=v_user for update;
  if not found then raise exception 'Empréstimo não encontrado.'; end if;
  if p_new_amount < coalesce(v_inst.amount_paid,0) then raise exception 'O novo valor não pode ser menor que o valor já recebido desta parcela.'; end if;

  v_new_remaining := p_new_amount-coalesce(v_inst.amount_paid,0);
  v_new_total := v_loan.total_receivable-v_inst.amount+p_new_amount;
  if v_new_total < v_loan.principal_amount then raise exception 'A renegociação deixaria o total a receber abaixo do valor emprestado.'; end if;
  v_new_profit := v_new_total-v_loan.principal_amount;
  if v_new_remaining<=0 then v_status:='PAGO'; elsif coalesce(v_inst.amount_paid,0)>0 then v_status:='PARCIAL'; else v_status:='REAGENDADO'; end if;

  update public.installments set due_date=p_new_due_date,amount=p_new_amount,remaining_amount=v_new_remaining,stored_status=v_status,updated_at=now() where id=v_inst.id and user_id=v_user;
  update public.loans set total_receivable=v_new_total,expected_profit=v_new_profit,updated_at=now() where id=v_loan.id and user_id=v_user;

  insert into public.activity_logs(user_id,entity_type,entity_id,action,old_data,new_data,description)
  values(v_user,'installment',v_inst.id,'renegotiated',jsonb_build_object('due_date',v_inst.due_date,'amount',v_inst.amount,'remaining_amount',v_inst.remaining_amount),jsonb_build_object('due_date',p_new_due_date,'amount',p_new_amount,'remaining_amount',v_new_remaining,'reason',nullif(trim(coalesce(p_reason,'')),'')),format('Parcela %s renegociada: vencimento %s → %s, valor %s → %s. %s',v_inst.installment_number,v_inst.due_date,p_new_due_date,v_inst.amount,p_new_amount,coalesce(nullif(trim(coalesce(p_reason,'')),''),'Sem motivo informado.')));
  return jsonb_build_object('ok',true,'loan_id',v_loan.id,'client_id',v_inst.client_id,'installment_id',v_inst.id,'new_total',v_new_total,'new_profit',v_new_profit);
end;
$$;

grant execute on function public.renegotiate_installment(uuid,date,numeric,text) to authenticated;

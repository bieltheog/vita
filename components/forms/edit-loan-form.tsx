"use client";

import { useMemo, useState, useTransition } from "react";
import { CirclePlus, Pencil, X } from "lucide-react";
import { updateLoanFormAction } from "@/app/loan-form-actions";
import { addLoanTopupAction } from "@/app/loan-topup-actions";
import { reschedulePaidLoanAction, updatePaidLoanStatusAction } from "@/app/loan-reschedule-actions";
import { brazilDateKey } from "@/lib/date";
import { calculateLoan, money, roundMoney, splitInstallments } from "@/lib/finance";
import { DailyOffDays } from "@/components/forms/daily-off-days";
import { ManualFixedInstallments, type ManualFixedRow } from "@/components/forms/manual-fixed-installments";
import type { Installment, Loan } from "@/lib/types";

function buildFixedRows(rows: ManualFixedRow[], count: number, total: number, keepAmounts = true) {
  const values=splitInstallments(total,count);
  return Array.from({length:count},(_,index)=>({
    date:rows[index]?.date||"",
    amount:keepAmounts&&rows[index]?.amount ? rows[index].amount : (values[index]||0).toFixed(2),
  }));
}

function sameDays(a:number[],b:number[]){
  const left=[...a].map(Number).sort((x,y)=>x-y);
  const right=[...b].map(Number).sort((x,y)=>x-y);
  return left.length===right.length&&left.every((day,index)=>day===right[index]);
}

export function EditLoanForm({ loan, installments=[] }: { loan: Loan; installments?: Installment[] }) {
  const sorted=[...installments].sort((a,b)=>a.installment_number-b.installment_number);
  const hasPayments=sorted.some(row=>Number(row.amount_paid)>0||row.stored_status==="PAGO"||row.stored_status==="PARCIAL");
  const lockedMax=sorted
    .filter(row=>Number(row.amount_paid)>0||row.stored_status==="PAGO"||row.stored_status==="PARCIAL")
    .reduce((max,row)=>Math.max(max,Number(row.installment_number)),0);
  const currentRemaining=roundMoney(sorted
    .filter(row=>row.stored_status!=="CANCELADO")
    .reduce((sum,row)=>sum+Number(row.remaining_amount),0));
  const unpaidRows=sorted.filter(row=>row.stored_status!=="CANCELADO"&&Number(row.remaining_amount)>0&&Number(row.amount_paid)<=0);

  const initialType: "percentage" | "fixed" = loan.fixed_return_amount != null ? "fixed" : "percentage";
  const initialReturn = initialType === "fixed" ? Number(loan.fixed_return_amount || 0) : Number(loan.return_percentage || 0);
  const initialFrequency=loan.payment_frequency==="PERSONALIZADO"?"DATAS_FIXAS":loan.payment_frequency;
  const initialCount=Number(loan.installment_count);
  const initialDays=(loan.daily_off_days||[]).map(Number).sort((a,b)=>a-b);
  const initialFirstDueDate=unpaidRows[0]?.due_date||loan.first_due_date;
  const initialFixedRows: ManualFixedRow[]=unpaidRows.map(row=>({date:row.due_date,amount:Number(row.remaining_amount).toFixed(2)}));
  const originalPrincipal=Number(loan.principal_amount);

  const [open,setOpen]=useState(false);
  const [pending,start]=useTransition();
  const [error,setError]=useState("");
  const [principal,setPrincipal]=useState(originalPrincipal);
  const [returnValue,setReturnValue]=useState(initialReturn);
  const [type,setType]=useState<"percentage"|"fixed">(initialType);
  const [count,setCount]=useState(initialCount);
  const [frequency,setFrequency]=useState(initialFrequency);
  const [dailyOffDays,setDailyOffDays]=useState<number[]>(initialDays);
  const [firstDueDate,setFirstDueDate]=useState(initialFirstDueDate);
  const [fixedRows,setFixedRows]=useState<ManualFixedRow[]>(initialFixedRows);
  const [fixedTouched,setFixedTouched]=useState(false);
  const [topupDate,setTopupDate]=useState(brazilDateKey());

  const daily=frequency==="DIARIO";
  const fixed=frequency==="DATAS_FIXAS";
  const topupPrincipal=roundMoney(Math.max(0,principal-originalPrincipal));
  const topupMode=hasPayments&&topupPrincipal>0.005;
  const reducingPrincipal=hasPayments&&principal<originalPrincipal-0.005;
  const paidScheduleMode=hasPayments&&!topupMode&&!reducingPrincipal;

  const normalCalc=useMemo(()=>calculateLoan(principal||0,type,returnValue||0),[principal,type,returnValue]);
  const additionCalc=useMemo(()=>calculateLoan(topupPrincipal||0,type,returnValue||0),[topupPrincipal,type,returnValue]);
  const newContractedTotal=roundMoney(Number(loan.total_receivable)+additionCalc.totalReceivable);
  const newRemaining=roundMoney(currentRemaining+additionCalc.totalReceivable);
  const futureCount=hasPayments
    ? (frequency==="UNICO"?1:Math.max(1,count-lockedMax))
    : count;
  const targetTotal=topupMode?newRemaining:paidScheduleMode?currentRemaining:normalCalc.totalReceivable;
  const targetCount=hasPayments?futureCount:count;
  const values=splitInstallments(targetTotal,targetCount||1);

  const scheduleChanged=paidScheduleMode&&(
    frequency!==initialFrequency||
    count!==initialCount||
    firstDueDate!==initialFirstDueDate||
    !sameDays(dailyOffDays,initialDays)||
    fixedTouched
  );

  const preserveFixedAmounts=Boolean(
    fixedTouched||
    (initialFrequency==="DATAS_FIXAS"&&frequency==="DATAS_FIXAS"&&count===initialCount)
  );
  const renderedFixedRows=buildFixedRows(fixedRows,targetCount,targetTotal,preserveFixedAmounts);

  function changePrincipal(next:number){
    setPrincipal(next);
    if(fixed&&hasPayments)setFixedTouched(false);
  }

  function changeFrequency(next:string){
    const wasFixed=frequency==="DATAS_FIXAS";
    setFrequency(next);
    if(next==="UNICO"&&hasPayments)setCount(Math.max(1,lockedMax+1));
    if(next==="DATAS_FIXAS"){
      if(!wasFixed)setFixedRows([]);
      setFixedTouched(false);
    }
  }

  function changeCount(next:number){
    const minimum=hasPayments?lockedMax+1:1;
    const safe=Math.max(minimum,next||minimum);
    setCount(safe);
    if(fixed)setFixedTouched(false);
  }

  function splitFixedEqually(){
    setFixedRows(rows=>buildFixedRows(rows,targetCount,targetTotal,false));
    setFixedTouched(true);
  }

  async function submit(formData:FormData){
    setError("");
    start(async()=>{
      if(reducingPrincipal){
        setError(`Este empréstimo já possui pagamento. O principal original de ${money(originalPrincipal)} não pode ser reduzido por esta tela.`);
        return;
      }

      if(topupMode){
        if(!topupDate){setError("Informe a data em que o valor adicional foi entregue.");return;}
        if(frequency!=="UNICO"&&count<=lockedMax){
          setError(`Como já existem ${lockedMax} parcela(s) no histórico, o total final precisa ser maior que ${lockedMax}.`);
          return;
        }
        formData.set("additional_principal",String(topupPrincipal));
        formData.set("topup_date",topupDate);
        formData.set("future_installment_count",String(futureCount));
        const result=await addLoanTopupAction(formData);
        if(!result.ok){setError(result.error);return;}
        setOpen(false);
        return;
      }

      if(hasPayments&&scheduleChanged){
        if(frequency!=="UNICO"&&count<=lockedMax){
          setError(`Como já existem ${lockedMax} parcela(s) com histórico de pagamento, informe pelo menos ${lockedMax+1} parcelas no total.`);
          return;
        }
        formData.set("future_installment_count",String(futureCount));
        const result=await reschedulePaidLoanAction(formData);
        if(!result.ok){setError(result.error);return;}
        setOpen(false);
        return;
      }

      if(hasPayments){
        const result=await updatePaidLoanStatusAction(formData);
        if(!result.ok){setError(result.error);return;}
        setOpen(false);
        return;
      }

      const result=await updateLoanFormAction(formData);
      if(!result.ok){setError(result.error);return;}
      setOpen(false);
    });
  }

  return <>
    <button className="icon-btn" title="Editar empréstimo" onClick={()=>setOpen(true)}><Pencil size={15}/></button>
    {open&&<div className="modal-backdrop"><div className="modal">
      <div className="section-title">
        <div><h2>Editar empréstimo</h2><div className="muted" style={{fontSize:12}}>{loan.loan_code} · {loan.client?.name||"Cliente"}</div></div>
        <button className="icon-btn" onClick={()=>setOpen(false)}><X size={17}/></button>
      </div>

      {paidScheduleMode&&<div className="alert" style={{marginTop:14,borderColor:scheduleChanged?"rgba(105,78,255,.45)":undefined}}>
        <strong>{scheduleChanged?"Correção do calendário detectada.":"Este empréstimo já possui pagamento."}</strong>{" "}
        Você pode corrigir forma de pagamento, quantidade, primeiro vencimento e dias sem cobrança. O que já foi pago fica preservado; somente o saldo futuro é reorganizado.
      </div>}
      {topupMode&&<div className="alert" style={{marginTop:14,borderColor:"rgba(105,78,255,.45)"}}>
        <strong>Adicional detectado: {money(topupPrincipal)}.</strong> Ao salvar, os pagamentos anteriores serão preservados e apenas o saldo/parcelas futuras serão reorganizados.
      </div>}
      {reducingPrincipal&&<div className="alert" style={{marginTop:14,borderColor:"rgba(255,98,109,.35)",color:"#ff9aa2"}}>
        O empréstimo já tem pagamentos. Para preservar o histórico, o valor original não pode ser reduzido por esta tela.
      </div>}

      <form action={submit} className="form-grid" style={{marginTop:14}}>
        <input type="hidden" name="loan_id" value={loan.id}/>

        <div className="field">
          <label>{hasPayments?"Novo total emprestado *":"Valor emprestado *"}</label>
          <input className="input" name="principal_amount" type="number" min={hasPayments?originalPrincipal:0.01} step="0.01" value={principal} onChange={e=>changePrincipal(Number(e.target.value))} required/>
          {hasPayments&&<div className="muted" style={{fontSize:11}}>Original: {money(originalPrincipal)}{topupMode?` · adicional: ${money(topupPrincipal)}`:""}</div>}
        </div>

        <div className="field">
          <label>Tipo de cálculo</label>
          <select className="select" name="calculation_type" value={type} disabled={paidScheduleMode} onChange={e=>{setType(e.target.value as "percentage"|"fixed");if(fixed&&hasPayments)setFixedTouched(false)}}>
            <option value="percentage">Porcentagem de retorno</option><option value="fixed">Valor fixo de retorno</option>
          </select>
          {paidScheduleMode&&<input type="hidden" name="calculation_type" value={initialType}/>} 
        </div>

        <div className="field">
          <label>{topupMode?(type==="percentage"?"Retorno sobre o adicional (%)":"Lucro sobre o adicional (R$)"):(type==="percentage"?"Retorno (%)":"Lucro fixo (R$)")}</label>
          <input className="input" name="return_value" type="number" min="0" step="0.01" value={returnValue} disabled={paidScheduleMode} onChange={e=>{setReturnValue(Number(e.target.value));if(fixed&&topupMode)setFixedTouched(false)}}/>
          {paidScheduleMode&&<input type="hidden" name="return_value" value={initialReturn}/>} 
        </div>

        <div className="field">
          <label>{hasPayments?"Forma das parcelas futuras":"Forma de pagamento"}</label>
          <select className="select" name="payment_frequency" value={frequency} onChange={e=>changeFrequency(e.target.value)}>
            <option value="UNICO">Pagamento único</option><option value="DIARIO">Diário</option><option value="SEMANAL">Semanal</option><option value="QUINZENAL">Quinzenal</option><option value="MENSAL">Mensal</option><option value="DATAS_FIXAS">Datas fixas</option>
          </select>
        </div>

        <div className="field">
          <label>{hasPayments?"Número total de parcelas após correção":"Número de parcelas"}</label>
          <input className="input" name="installment_count" type="number" min={hasPayments?lockedMax+1:1} value={count} disabled={hasPayments&&frequency==="UNICO"} onChange={e=>changeCount(Number(e.target.value))}/>
          {hasPayments&&<div className="muted" style={{fontSize:11}}>{lockedMax} parcela(s) ficam no histórico · {futureCount} parcela(s) futuras serão criadas</div>}
        </div>

        {daily&&<DailyOffDays selected={dailyOffDays} onChange={setDailyOffDays}/>} 
        {fixed&&<ManualFixedInstallments rows={renderedFixedRows} total={targetTotal} onChange={rows=>{setFixedRows(rows);setFixedTouched(true)}} onSplitEqually={splitFixedEqually}/>} 

        {topupMode?<>
          <div className="field"><label>Data do valor adicional *</label><input className="input" name="topup_date" type="date" max={brazilDateKey()} value={topupDate} onChange={e=>setTopupDate(e.target.value)} required/></div>
          <div className="field"><label>Data original do empréstimo</label><input className="input" type="date" value={loan.start_date} disabled/></div>
        </>:<>
          <div className="field"><label>Status</label><select className="select" name="status" defaultValue={loan.status}><option value="ATIVO">Ativo</option><option value="FINALIZADO">Finalizado</option><option value="CANCELADO">Cancelado</option></select></div>
          <div className="field"><label>Data do empréstimo *</label><input className="input" name="start_date" type="date" defaultValue={loan.start_date} disabled={hasPayments} required/>{hasPayments&&<input type="hidden" name="start_date" value={loan.start_date}/>}</div>
        </>}

        {!fixed&&<div className="field"><label>{hasPayments?"Primeiro vencimento do novo calendário *":"Primeiro pagamento *"}</label><input className="input" name="first_due_date" type="date" value={firstDueDate} onChange={e=>setFirstDueDate(e.target.value)} required/></div>}

        {daily&&<div className="field full"><div className="alert">Os dias marcados são pulados na sequência diária. As parcelas futuras avançam para os próximos dias permitidos.</div></div>}
        {fixed&&<div className="field full"><div className="alert">Cada parcela futura pode ter uma data e um valor diferentes. A soma precisa fechar exatamente o saldo ainda pendente.</div></div>}

        <div className="field full"><div className="card" style={{background:"#090c11"}}>
          {topupMode?<>
            <div className="grid-equal"><div><div className="muted" style={{fontSize:11}}>Saldo antes do adicional</div><strong>{money(currentRemaining)}</strong></div><div><div className="muted" style={{fontSize:11}}>Novo principal entregue</div><strong>{money(topupPrincipal)}</strong></div><div><div className="muted" style={{fontSize:11}}>Lucro do adicional</div><strong>{money(additionCalc.expectedProfit)}</strong></div></div>
            <div className="divider"/>
            <div className="grid-equal"><div><div className="muted" style={{fontSize:11}}>Total contratado após adicional</div><strong>{money(newContractedTotal)}</strong></div><div><div className="muted" style={{fontSize:11}}>Saldo futuro após pagamentos já feitos</div><strong style={{color:"var(--green)"}}>{money(newRemaining)}</strong></div></div>
            <div className="divider"/><div className="muted" style={{fontSize:12}}>{futureCount} parcela(s) futura(s) de aproximadamente <strong style={{color:"white"}}>{money(values[0]||0)}</strong></div>
          </>:paidScheduleMode?<>
            <div className="grid-equal"><div><div className="muted" style={{fontSize:11}}>Total contratado</div><strong>{money(loan.total_receivable)}</strong></div><div><div className="muted" style={{fontSize:11}}>Saldo ainda pendente</div><strong style={{color:"var(--green)"}}>{money(currentRemaining)}</strong></div></div>
            <div className="divider"/><div className="muted" style={{fontSize:12}}>{futureCount} parcela(s) futura(s) de aproximadamente <strong style={{color:"white"}}>{money(values[0]||0)}</strong>. Pagamentos anteriores não serão alterados.</div>
          </>:<>
            <div className="grid-equal"><div><div className="muted" style={{fontSize:11}}>Lucro esperado</div><strong>{money(normalCalc.expectedProfit)}</strong></div><div><div className="muted" style={{fontSize:11}}>Total a receber</div><strong>{money(normalCalc.totalReceivable)}</strong></div></div>
            <div className="divider"/><div className="muted" style={{fontSize:12}}>{fixed?`${count} parcelas com datas e valores definidos por você`:<>{count}x de aproximadamente <strong style={{color:"white"}}>{money(values[0]||0)}</strong></>}</div>
          </>}
        </div></div>

        {error&&<div className="field full"><div className="alert" style={{borderColor:"rgba(255,98,109,.35)",color:"#ff9aa2"}}>{error}</div></div>}
        <div className="field full" style={{flexDirection:"row",justifyContent:"flex-end",flexWrap:"wrap"}}>
          <button type="button" className="btn secondary" onClick={()=>setOpen(false)}>Cancelar</button>
          <button className="btn" disabled={pending||reducingPrincipal}>{topupMode&&<CirclePlus size={16}/>} {pending?"Salvando...":topupMode?`Adicionar ${money(topupPrincipal)} e salvar`:scheduleChanged?"Corrigir calendário":"Salvar alterações"}</button>
        </div>
      </form>
    </div></div>}
  </>;
}

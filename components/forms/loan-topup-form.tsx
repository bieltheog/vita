"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CirclePlus, X } from "lucide-react";
import { addLoanTopupAction } from "@/app/loan-topup-actions";
import { brazilDateKey } from "@/lib/date";
import { calculateLoan, money, roundMoney, splitInstallments } from "@/lib/finance";
import { DailyOffDays } from "@/components/forms/daily-off-days";
import { ManualFixedInstallments, type ManualFixedRow } from "@/components/forms/manual-fixed-installments";
import type { Installment, Loan } from "@/lib/types";

function buildFixedRows(rows:ManualFixedRow[],count:number,total:number){
  const values=splitInstallments(total,count);
  return Array.from({length:count},(_,index)=>({
    date:rows[index]?.date||"",
    amount:(values[index]||0).toFixed(2),
  }));
}

export function LoanTopupForm({loan,installments=[],compact=false}:{loan:Loan;installments?:Installment[];compact?:boolean}){
  const router=useRouter();
  const activeRows=useMemo(()=>[...installments]
    .filter(row=>row.stored_status!=="CANCELADO"&&Number(row.remaining_amount)>0)
    .sort((a,b)=>a.due_date.localeCompare(b.due_date)),[installments]);
  const currentRemaining=useMemo(()=>roundMoney(activeRows.reduce((sum,row)=>sum+Number(row.remaining_amount),0)),[activeRows]);
  const effectiveRate=Number(loan.principal_amount)>0?roundMoney(Number(loan.expected_profit)/Number(loan.principal_amount)*100):Number(loan.return_percentage||0);
  const initialCount=Math.max(1,activeRows.length||1);
  const initialFrequency=loan.payment_frequency==="PERSONALIZADO"?"DATAS_FIXAS":loan.payment_frequency;
  const initialFirstDue=activeRows[0]?.due_date||loan.first_due_date||brazilDateKey();
  const initialRows=activeRows.map(row=>({date:row.due_date,amount:Number(row.remaining_amount).toFixed(2)}));

  const [open,setOpen]=useState(false);
  const [pending,start]=useTransition();
  const [error,setError]=useState("");
  const [additional,setAdditional]=useState(0);
  const [type,setType]=useState<"percentage"|"fixed">("percentage");
  const [returnValue,setReturnValue]=useState(effectiveRate);
  const [frequency,setFrequency]=useState(initialFrequency);
  const [count,setCount]=useState(initialFrequency==="UNICO"?1:initialCount);
  const [firstDueDate,setFirstDueDate]=useState(initialFirstDue);
  const [dailyOffDays,setDailyOffDays]=useState<number[]>((loan.daily_off_days||[]).map(Number));
  const [fixedRows,setFixedRows]=useState<ManualFixedRow[]>(initialRows);
  const [fixedTouched,setFixedTouched]=useState(false);

  const addition=useMemo(()=>calculateLoan(additional||0,type,returnValue||0),[additional,type,returnValue]);
  const newRemaining=roundMoney(currentRemaining+addition.totalReceivable);
  const fixed=frequency==="DATAS_FIXAS";
  const daily=frequency==="DIARIO";
  const futureValues=splitInstallments(newRemaining,count||1);

  useEffect(()=>{
    if(fixed&&!fixedTouched){
      setFixedRows(rows=>buildFixedRows(rows,count,newRemaining));
    }
  },[fixed,fixedTouched,count,newRemaining]);

  function changeFrequency(next:string){
    setFrequency(next);
    if(next==="UNICO") setCount(1);
    if(next==="DATAS_FIXAS") setFixedTouched(false);
  }
  function changeCount(value:number){
    const safe=frequency==="UNICO"?1:Math.max(1,value||1);
    setCount(safe);
    if(fixed)setFixedTouched(false);
  }
  function splitFixed(){
    setFixedRows(rows=>buildFixedRows(rows,count,newRemaining));
    setFixedTouched(false);
  }
  function openModal(){
    setError("");
    setOpen(true);
  }
  async function submit(formData:FormData){
    setError("");
    start(async()=>{
      const result=await addLoanTopupAction(formData);
      if(!result.ok){setError(result.error);return;}
      setOpen(false);
      router.refresh();
    });
  }

  const trigger=compact
    ? <button className="icon-btn" type="button" title="Adicionar valor ao empréstimo" onClick={openModal}><CirclePlus size={16}/></button>
    : <button className="btn" type="button" onClick={openModal}><CirclePlus size={16}/>Adicionar valor</button>;

  return <>
    {trigger}
    {open&&<div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target&&!pending)setOpen(false)}}><div className="modal" style={{maxWidth:850}}>
      <div className="section-title">
        <div><div className="eyebrow">Adicional no mesmo contrato</div><h2>Adicionar valor ao empréstimo</h2><div className="muted" style={{fontSize:12}}>{loan.loan_code} · {loan.client?.name||"Cliente"}</div></div>
        <button className="icon-btn" type="button" disabled={pending} onClick={()=>setOpen(false)}><X size={17}/></button>
      </div>

      <div className="alert" style={{marginTop:12}}><strong>Os pagamentos anteriores não serão alterados.</strong> O Jureminha soma o novo valor ao saldo que ainda falta receber e recria somente o calendário futuro. Parcelas que já tiveram pagamento continuam guardadas no histórico.</div>

      <form action={submit} className="form-grid" style={{marginTop:16}}>
        <input type="hidden" name="loan_id" value={loan.id}/>
        <div className="field"><label>Novo valor emprestado *</label><input className="input" name="additional_principal" type="number" min="0.01" step="0.01" value={additional||""} onChange={e=>setAdditional(Number(e.target.value))} placeholder="500,00" required/></div>
        <div className="field"><label>Data do adicional *</label><input className="input" name="topup_date" type="date" max={brazilDateKey()} defaultValue={brazilDateKey()} required/></div>
        <div className="field"><label>Cálculo do retorno do novo valor</label><select className="select" name="calculation_type" value={type} onChange={e=>setType(e.target.value as "percentage"|"fixed")}><option value="percentage">Porcentagem</option><option value="fixed">Lucro fixo</option></select></div>
        <div className="field"><label>{type==="percentage"?"Retorno sobre o adicional (%)":"Lucro sobre o adicional (R$)"}</label><input className="input" name="return_value" type="number" min="0" step="0.01" value={returnValue} onChange={e=>setReturnValue(Number(e.target.value))}/></div>

        <div className="field full"><div className="topup-summary">
          <div><span>Saldo atual</span><strong>{money(currentRemaining)}</strong></div>
          <div><span>Novo valor + retorno</span><strong>{money(addition.totalReceivable)}</strong><small>{money(additional)} principal + {money(addition.expectedProfit)} lucro</small></div>
          <div><span>Novo saldo a receber</span><strong>{money(newRemaining)}</strong></div>
        </div></div>

        <div className="field"><label>Forma das parcelas futuras</label><select className="select" name="payment_frequency" value={frequency} onChange={e=>changeFrequency(e.target.value)}><option value="UNICO">Pagamento único</option><option value="DIARIO">Diário</option><option value="SEMANAL">Semanal</option><option value="QUINZENAL">Quinzenal</option><option value="MENSAL">Mensal</option><option value="DATAS_FIXAS">Datas fixas</option></select></div>
        <div className="field"><label>Quantidade de parcelas futuras</label><input className="input" name="future_installment_count" type="number" min="1" value={count} disabled={frequency==="UNICO"} onChange={e=>changeCount(Number(e.target.value))}/>{frequency==="UNICO"&&<input type="hidden" name="future_installment_count" value="1"/>}</div>
        {daily&&<DailyOffDays selected={dailyOffDays} onChange={setDailyOffDays}/>} 
        {!fixed&&<div className="field"><label>Primeiro vencimento do novo calendário *</label><input className="input" name="first_due_date" type="date" value={firstDueDate} onChange={e=>setFirstDueDate(e.target.value)} required/></div>}
        {fixed&&<ManualFixedInstallments rows={buildFixedRows(fixedRows,count,newRemaining).map((row,index)=>fixedTouched?(fixedRows[index]||row):row)} total={newRemaining} onChange={rows=>{setFixedRows(rows);setFixedTouched(true)}} onSplitEqually={splitFixed}/>} 

        {!fixed&&<div className="field full"><div className="card topup-preview"><div className="muted" style={{fontSize:11}}>Novo calendário</div><strong>{count}x de aproximadamente {money(futureValues[0]||0)}</strong><div className="stat-meta">Total futuro: {money(newRemaining)}. O valor exato da última parcela é ajustado automaticamente aos centavos.</div></div></div>}
        <div className="field full"><label>Observação</label><input className="input" name="notes" placeholder="Ex.: emprestei mais R$ 500 em 21/08"/></div>
        {error&&<div className="field full"><div className="alert" style={{borderColor:"rgba(255,98,109,.3)",color:"#ff9aa2"}}>{error}</div></div>}
        <div className="field full" style={{flexDirection:"row",justifyContent:"flex-end",flexWrap:"wrap"}}><button type="button" className="btn secondary" disabled={pending} onClick={()=>setOpen(false)}>Cancelar</button><button className="btn" disabled={pending||additional<=0}><CirclePlus size={16}/>{pending?"Atualizando...":"Adicionar e refazer parcelas futuras"}</button></div>
      </form>
    </div></div>}
  </>;
}

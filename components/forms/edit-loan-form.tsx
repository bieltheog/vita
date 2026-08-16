"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil, X } from "lucide-react";
import { updateLoanFormAction } from "@/app/loan-form-actions";
import { calculateLoan, money, splitInstallments } from "@/lib/finance";
import { DailyOffDays } from "@/components/forms/daily-off-days";
import { ManualFixedInstallments, type ManualFixedRow } from "@/components/forms/manual-fixed-installments";
import type { Installment, Loan } from "@/lib/types";

function resizeFixedRows(rows: ManualFixedRow[], count: number, total: number) {
  const values=splitInstallments(total,count);
  return Array.from({length:count},(_,index)=>rows[index]||{date:"",amount:(values[index]||0).toFixed(2)});
}

export function EditLoanForm({ loan, installments=[] }: { loan: Loan; installments?: Installment[] }) {
  const sorted=[...installments].sort((a,b)=>a.installment_number-b.installment_number);
  const initialType: "percentage" | "fixed" = loan.fixed_return_amount != null ? "fixed" : "percentage";
  const initialReturn = initialType === "fixed" ? Number(loan.fixed_return_amount || 0) : Number(loan.return_percentage || 0);
  const initialFixedRows: ManualFixedRow[]=sorted.map(row=>({date:row.due_date,amount:Number(row.amount).toFixed(2)}));
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [principal, setPrincipal] = useState(Number(loan.principal_amount));
  const [returnValue, setReturnValue] = useState(initialReturn);
  const [type, setType] = useState<"percentage" | "fixed">(initialType);
  const [count, setCount] = useState(Number(loan.installment_count));
  const [frequency,setFrequency]=useState(loan.payment_frequency==="PERSONALIZADO"?"DATAS_FIXAS":loan.payment_frequency);
  const [dailyOffDays,setDailyOffDays]=useState<number[]>((loan.daily_off_days || []).map(Number));
  const [firstDueDate,setFirstDueDate]=useState(loan.first_due_date);
  const [fixedRows,setFixedRows]=useState<ManualFixedRow[]>(initialFixedRows);
  const daily=frequency==="DIARIO";
  const fixed=frequency==="DATAS_FIXAS";

  const calc = useMemo(() => calculateLoan(principal || 0, type, returnValue || 0), [principal, type, returnValue]);
  const values = splitInstallments(calc.totalReceivable, count || 1);

  function changeFrequency(next:string){
    setFrequency(next);
    if(next==="DATAS_FIXAS") setFixedRows(rows=>resizeFixedRows(rows,count,calc.totalReceivable));
  }
  function changeCount(next:number){
    const safe=Math.max(1,next||1);
    setCount(safe);
    if(fixed) setFixedRows(rows=>resizeFixedRows(rows,safe,calc.totalReceivable));
  }
  function splitFixedEqually(){
    const split=splitInstallments(calc.totalReceivable,count);
    setFixedRows(rows=>resizeFixedRows(rows,count,calc.totalReceivable).map((row,index)=>({...row,amount:(split[index]||0).toFixed(2)})));
  }

  async function submit(formData: FormData) {
    setError("");
    start(async () => {
      const result=await updateLoanFormAction(formData);
      if(!result.ok){setError(result.error);return;}
      setOpen(false);
    });
  }

  return <>
    <button className="icon-btn" title="Editar empréstimo" onClick={() => setOpen(true)}><Pencil size={15}/></button>
    {open && <div className="modal-backdrop"><div className="modal">
      <div className="section-title">
        <div><h2>Editar empréstimo</h2><div className="muted" style={{fontSize:12}}>{loan.loan_code} · {loan.client?.name || "Cliente"}</div></div>
        <button className="icon-btn" onClick={() => setOpen(false)}><X size={17}/></button>
      </div>
      <div className="alert" style={{marginTop:14}}>Ao salvar uma edição sem pagamentos, as parcelas e o calendário são sincronizados. Se já houver pagamento registrado, valores e datas ficam protegidos para preservar o histórico.</div>
      <form action={submit} className="form-grid" style={{marginTop:14}}>
        <input type="hidden" name="loan_id" value={loan.id}/>
        <div className="field"><label>Valor emprestado *</label><input className="input" name="principal_amount" type="number" min="0.01" step="0.01" value={principal} onChange={e=>setPrincipal(Number(e.target.value))} required/></div>
        <div className="field"><label>Tipo de cálculo</label><select className="select" name="calculation_type" value={type} onChange={e=>setType(e.target.value as "percentage"|"fixed")}><option value="percentage">Porcentagem de retorno</option><option value="fixed">Valor fixo de retorno</option></select></div>
        <div className="field"><label>{type === "percentage" ? "Retorno (%)" : "Lucro fixo (R$)"}</label><input className="input" name="return_value" type="number" min="0" step="0.01" value={returnValue} onChange={e=>setReturnValue(Number(e.target.value))}/></div>
        <div className="field"><label>Forma de pagamento</label><select className="select" name="payment_frequency" value={frequency} onChange={e=>changeFrequency(e.target.value)}><option value="UNICO">Pagamento único</option><option value="DIARIO">Diário</option><option value="SEMANAL">Semanal</option><option value="QUINZENAL">Quinzenal</option><option value="MENSAL">Mensal</option><option value="DATAS_FIXAS">Datas fixas</option></select></div>
        <div className="field"><label>Número de parcelas</label><input className="input" name="installment_count" type="number" min="1" value={count} onChange={e=>changeCount(Number(e.target.value))}/></div>
        {daily&&<DailyOffDays selected={dailyOffDays} onChange={setDailyOffDays}/>} 
        {fixed&&<ManualFixedInstallments rows={resizeFixedRows(fixedRows,count,calc.totalReceivable)} total={calc.totalReceivable} onChange={setFixedRows} onSplitEqually={splitFixedEqually}/>} 
        <div className="field"><label>Status</label><select className="select" name="status" defaultValue={loan.status}><option value="ATIVO">Ativo</option><option value="FINALIZADO">Finalizado</option><option value="CANCELADO">Cancelado</option></select></div>
        <div className="field"><label>Data do empréstimo *</label><input className="input" name="start_date" type="date" defaultValue={loan.start_date} required/></div>
        {!fixed&&<div className="field"><label>Primeiro pagamento *</label><input className="input" name="first_due_date" type="date" value={firstDueDate} onChange={e=>setFirstDueDate(e.target.value)} required/></div>}
        {daily&&<div className="field full"><div className="alert">Os dias de folga são retirados da sequência diária. As parcelas continuam existindo e os vencimentos seguintes avançam para os próximos dias permitidos.</div></div>}
        {fixed&&<div className="field full"><div className="alert">Cada parcela pode ter uma data e um valor diferentes. A soma precisa fechar exatamente o total a receber.</div></div>}
        <div className="field full"><div className="card" style={{background:"#090c11"}}><div className="grid-equal"><div><div className="muted" style={{fontSize:11}}>Lucro esperado</div><strong>{money(calc.expectedProfit)}</strong></div><div><div className="muted" style={{fontSize:11}}>Total a receber</div><strong>{money(calc.totalReceivable)}</strong></div></div><div className="divider"/><div className="muted" style={{fontSize:12}}>{fixed?`${count} parcelas com datas e valores definidos por você`:<>{count}x de aproximadamente <strong style={{color:"white"}}>{money(values[0] || 0)}</strong></>}</div></div></div>
        {error && <div className="field full"><div className="alert">{error}</div></div>}
        <div className="field full" style={{flexDirection:"row",justifyContent:"flex-end"}}><button type="button" className="btn secondary" onClick={()=>setOpen(false)}>Cancelar</button><button className="btn" disabled={pending}>{pending ? "Salvando..." : "Salvar alterações"}</button></div>
      </form>
    </div></div>}
  </>;
}

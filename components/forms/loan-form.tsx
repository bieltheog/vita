"use client";
import { useMemo, useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { createLoanAction } from "@/app/actions";
import { calculateLoan, money, splitInstallments } from "@/lib/finance";
import { DailyOffDays } from "@/components/forms/daily-off-days";
import { ManualFixedInstallments, type ManualFixedRow } from "@/components/forms/manual-fixed-installments";
import type { Client } from "@/lib/types";

function resizeFixedRows(rows: ManualFixedRow[], count: number, total: number) {
  const values=splitInstallments(total,count);
  return Array.from({length:count},(_,index)=>rows[index]||{date:"",amount:(values[index]||0).toFixed(2)});
}

export function LoanForm({ clients, demo=false }: { clients: Client[]; demo?: boolean }) {
  const [open,setOpen]=useState(false);
  const [pending,start]=useTransition();
  const [error,setError]=useState("");
  const [principal,setPrincipal]=useState(1000);
  const [returnValue,setReturnValue]=useState(30);
  const [type,setType]=useState<"percentage"|"fixed">("percentage");
  const [count,setCount]=useState(5);
  const [frequency,setFrequency]=useState("MENSAL");
  const [dailyOffDays,setDailyOffDays]=useState<number[]>([0]);
  const [fixedRows,setFixedRows]=useState<ManualFixedRow[]>([]);
  const daily=frequency==="DIARIO";
  const fixed=frequency==="DATAS_FIXAS";
  const calc=useMemo(()=>calculateLoan(principal||0,type,returnValue||0),[principal,type,returnValue]);
  const installments=splitInstallments(calc.totalReceivable,count||1);

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
    const values=splitInstallments(calc.totalReceivable,count);
    setFixedRows(rows=>resizeFixedRows(rows,count,calc.totalReceivable).map((row,index)=>({...row,amount:(values[index]||0).toFixed(2)})));
  }

  async function submit(formData:FormData){
    setError("");
    start(async()=>{try{await createLoanAction(formData);setOpen(false)}catch(e){setError(e instanceof Error?e.message:"Erro ao criar empréstimo")}})
  }

  return <>
    <button className="btn" onClick={()=>setOpen(true)}><Plus size={16}/> Novo Empréstimo</button>
    {open&&<div className="modal-backdrop"><div className="modal">
      <div className="section-title"><div><h2>Novo empréstimo</h2><div className="muted" style={{fontSize:12}}>Cálculo e parcelas são gerados automaticamente.</div></div><button className="icon-btn" onClick={()=>setOpen(false)}><X size={17}/></button></div>
      {demo&&<div className="alert">Modo demonstração: conecte o Supabase para gravar empréstimos.</div>}
      <form action={submit} className="form-grid" style={{marginTop:14}}>
        <div className="field full"><label>Cliente *</label><select className="select" name="client_id" required><option value="">Selecione</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="field"><label>Valor emprestado *</label><input className="input" name="principal_amount" type="number" min="0.01" step="0.01" value={principal} onChange={e=>setPrincipal(Number(e.target.value))}/></div>
        <div className="field"><label>Tipo de cálculo</label><select className="select" name="calculation_type" value={type} onChange={e=>setType(e.target.value as "percentage"|"fixed")}><option value="percentage">Porcentagem de retorno</option><option value="fixed">Valor fixo de retorno</option></select></div>
        <div className="field"><label>{type==="percentage"?"Retorno (%)":"Lucro fixo (R$)"}</label><input className="input" name="return_value" type="number" min="0" step="0.01" value={returnValue} onChange={e=>setReturnValue(Number(e.target.value))}/></div>
        <div className="field"><label>Forma de pagamento</label><select className="select" name="payment_frequency" value={frequency} onChange={e=>changeFrequency(e.target.value)}><option value="UNICO">Pagamento único</option><option value="DIARIO">Diário</option><option value="SEMANAL">Semanal</option><option value="QUINZENAL">Quinzenal</option><option value="MENSAL">Mensal</option><option value="DATAS_FIXAS">Datas fixas</option></select></div>
        <div className="field"><label>Número de parcelas</label><input className="input" name="installment_count" type="number" min="1" value={count} onChange={e=>changeCount(Number(e.target.value))}/></div>
        {daily&&<DailyOffDays selected={dailyOffDays} onChange={setDailyOffDays}/>} 
        {fixed&&<ManualFixedInstallments rows={resizeFixedRows(fixedRows,count,calc.totalReceivable)} total={calc.totalReceivable} onChange={setFixedRows} onSplitEqually={splitFixedEqually}/>} 
        <div className="field"><label>Data do empréstimo *</label><input className="input" name="start_date" type="date" required/></div>
        {!fixed&&<div className="field"><label>Primeiro pagamento *</label><input className="input" name="first_due_date" type="date" required/></div>}
        {daily&&<div className="field full"><div className="alert">No modo diário, os dias marcados acima são pulados. Ex.: se domingo estiver marcado, nenhuma parcela diária vence no domingo.</div></div>}
        {fixed&&<div className="field full"><div className="alert">Em Datas fixas, cada parcela tem sua própria data e seu próprio valor. A soma dos valores precisa ser igual ao total a receber.</div></div>}
        <div className="field full"><div className="card" style={{background:"#090c11"}}><div className="grid-equal"><div><div className="muted" style={{fontSize:11}}>Lucro esperado</div><strong>{money(calc.expectedProfit)}</strong></div><div><div className="muted" style={{fontSize:11}}>Total a receber</div><strong>{money(calc.totalReceivable)}</strong></div></div><div className="divider"/><div className="muted" style={{fontSize:12}}>{fixed?`${count} parcelas com datas e valores definidos por você`:<>{count}x de aproximadamente <strong style={{color:"white"}}>{money(installments[0]||0)}</strong></>}</div></div></div>
        {error&&<div className="field full"><div className="alert">{error}</div></div>}
        <div className="field full" style={{flexDirection:"row",justifyContent:"flex-end"}}><button type="button" className="btn secondary" onClick={()=>setOpen(false)}>Cancelar</button><button className="btn" disabled={pending||demo}>{pending?"Criando...":"Criar empréstimo"}</button></div>
      </form>
    </div></div>}
  </>;
}

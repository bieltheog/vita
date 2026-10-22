"use client";
import { useMemo, useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { createLoanFormAction } from "@/app/loan-form-actions";
import { calculateLoan, money, splitInstallments } from "@/lib/finance";
import { DailyOffDays } from "@/components/forms/daily-off-days";
import { ManualFixedInstallments, type ManualFixedRow } from "@/components/forms/manual-fixed-installments";
import type { Client } from "@/lib/types";

function resizeFixedRows(rows: ManualFixedRow[], count: number, total: number) {
  const values=splitInstallments(total,count);
  return Array.from({length:count},(_,index)=>rows[index]||{date:"",amount:(values[index]||0).toFixed(2)});
}

export function LoanForm({ clients, demo=false, initialClientId="", buttonLabel="Novo Empréstimo" }: { clients: Client[]; demo?: boolean; initialClientId?: string; buttonLabel?: string }) {
  const [open,setOpen]=useState(false);
  const [pending,start]=useTransition();
  const [error,setError]=useState("");
  const [principalInput,setPrincipalInput]=useState("1000");
  const [returnInput,setReturnInput]=useState("30");
  const [type,setType]=useState<"percentage"|"fixed">("percentage");
  const [countInput,setCountInput]=useState("5");
  const [frequency,setFrequency]=useState("MENSAL");
  const [dailyOffDays,setDailyOffDays]=useState<number[]>([0]);
  const [fixedRows,setFixedRows]=useState<ManualFixedRow[]>([]);
  const single=frequency==="UNICO";
  const daily=frequency==="DIARIO";
  const fixed=frequency==="DATAS_FIXAS";
  const principal=Number(principalInput)||0;
  const returnValue=Number(returnInput)||0;
  const count=Math.max(1,Math.floor(Number(countInput)||1));
  const calc=useMemo(()=>calculateLoan(principal,type,returnValue),[principal,type,returnValue]);
  const installments=splitInstallments(calc.totalReceivable,count);

  function changeFrequency(next:string){
    setFrequency(next);
    if(next==="UNICO")setCountInput("1");
    if(next==="DATAS_FIXAS")setFixedRows(rows=>resizeFixedRows(rows,count,calc.totalReceivable));
  }
  function changeCount(raw:string){
    if(single){setCountInput("1");return;}
    if(raw===""){setCountInput("");return;}
    const next=Math.floor(Number(raw));
    if(!Number.isFinite(next))return;
    setCountInput(String(next));
    if(fixed&&next>0)setFixedRows(rows=>resizeFixedRows(rows,next,calc.totalReceivable));
  }
  function splitFixedEqually(){const values=splitInstallments(calc.totalReceivable,count);setFixedRows(rows=>resizeFixedRows(rows,count,calc.totalReceivable).map((row,index)=>({...row,amount:(values[index]||0).toFixed(2)})));}

  async function submit(formData:FormData){
    setError("");
    if(!String(formData.get("principal_amount")||"").trim()){setError("Informe o valor emprestado.");return;}
    if(!String(formData.get("return_value")||"").trim()){setError("Informe o retorno.");return;}
    if(!single&&!String(formData.get("installment_count")||"").trim()){
      setError("Informe o número de parcelas.");
      return;
    }
    const startDate=String(formData.get("start_date")||"");
    const firstDueDate=fixed
      ? String(formData.get("fixed_due_date_0")||"")
      : String(formData.get("first_due_date")||"");
    if(startDate&&firstDueDate&&firstDueDate<startDate){
      const confirmed=window.confirm("O primeiro vencimento está antes da data do empréstimo. Isso normalmente só deve ser usado para corrigir um cadastro. Deseja salvar assim mesmo?");
      if(!confirmed)return;
      formData.set("allow_due_before_start","1");
    }
    start(async()=>{const result=await createLoanFormAction(formData);if(!result.ok){setError(result.error);return;}setOpen(false);});
  }

  return <>
    <button className="btn" onClick={()=>setOpen(true)}><Plus size={16}/>{buttonLabel}</button>
    {open&&<div className="modal-backdrop"><div className="modal">
      <div className="section-title"><div><h2>Novo empréstimo</h2><div className="muted" style={{fontSize:12}}>Cálculo e parcelas são gerados automaticamente.</div></div><button className="icon-btn" onClick={()=>setOpen(false)}><X size={17}/></button></div>
      {demo&&<div className="alert">Modo demonstração: conecte o Supabase para gravar empréstimos.</div>}
      <form action={submit} className="form-grid" style={{marginTop:14}}>
        <div className="field full"><label>Cliente *</label><select className="select" name="client_id" required defaultValue={initialClientId}><option value="">Selecione</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="field"><label>Valor emprestado *</label><input className="input" name="principal_amount" type="number" min="0.01" step="0.01" value={principalInput} onChange={e=>setPrincipalInput(e.target.value)} required/></div>
        <div className="field"><label>Tipo de cálculo</label><select className="select" name="calculation_type" value={type} onChange={e=>setType(e.target.value as "percentage"|"fixed")}><option value="percentage">Porcentagem de retorno</option><option value="fixed">Valor fixo de retorno</option></select></div>
        <div className="field"><label>{type==="percentage"?"Retorno (%)":"Lucro fixo (R$)"}</label><input className="input" name="return_value" type="number" min="0" step="0.01" value={returnInput} onChange={e=>setReturnInput(e.target.value)} required/></div>
        <div className="field"><label>Forma de pagamento</label><select className="select" name="payment_frequency" value={frequency} onChange={e=>changeFrequency(e.target.value)}><option value="UNICO">Pagamento único</option><option value="DIARIO">Diário</option><option value="SEMANAL">Semanal</option><option value="QUINZENAL">Quinzenal</option><option value="MENSAL">Mensal</option><option value="DATAS_FIXAS">Datas fixas</option></select></div>
        {single
          ? <input type="hidden" name="installment_count" value="1"/>
          : <div className="field"><label>Número de parcelas</label><input className="input" name="installment_count" type="number" min="1" value={countInput} onChange={e=>changeCount(e.target.value)} required/></div>}
        {daily&&<DailyOffDays selected={dailyOffDays} onChange={setDailyOffDays}/>} 
        {fixed&&<ManualFixedInstallments rows={resizeFixedRows(fixedRows,count,calc.totalReceivable)} total={calc.totalReceivable} onChange={setFixedRows} onSplitEqually={splitFixedEqually}/>} 
        <div className="field"><label>Data do empréstimo *</label><input className="input" name="start_date" type="date" required/></div>
        {!fixed&&<div className="field"><label>Primeiro pagamento *</label><input className="input" name="first_due_date" type="date" required/></div>}
        {daily&&<div className="field full"><div className="alert">No modo diário, os dias marcados acima são pulados. Ex.: se domingo estiver marcado, nenhuma parcela diária vence no domingo.</div></div>}
        {fixed&&<div className="field full"><div className="alert">Em Datas fixas, cada parcela tem sua própria data e seu próprio valor. A soma dos valores precisa ser igual ao total a receber.</div></div>}
        <div className="field full"><div className="card" style={{background:"#090c11"}}><div className="grid-equal"><div><div className="muted" style={{fontSize:11}}>Lucro esperado</div><strong>{money(calc.expectedProfit)}</strong></div><div><div className="muted" style={{fontSize:11}}>Total a receber</div><strong>{money(calc.totalReceivable)}</strong></div></div><div className="divider"/><div className="muted" style={{fontSize:12}}>{single?<>Pagamento único de <strong style={{color:"white"}}>{money(calc.totalReceivable)}</strong></>:fixed?`${count} parcelas com datas e valores definidos por você`:<>{count}x de aproximadamente <strong style={{color:"white"}}>{money(installments[0]||0)}</strong></>}</div></div></div>
        {error&&<div className="field full"><div className="alert">{error}</div></div>}
        <div className="field full" style={{flexDirection:"row",justifyContent:"flex-end"}}><button type="button" className="btn secondary" onClick={()=>setOpen(false)}>Cancelar</button><button className="btn" disabled={pending||demo||!principalInput.trim()||!returnInput.trim()||(!single&&!countInput.trim())}>{pending?"Criando...":"Criar empréstimo"}</button></div>
      </form>
    </div></div>}
  </>;
}

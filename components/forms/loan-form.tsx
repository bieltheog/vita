"use client";
import { useMemo, useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { createLoanAction } from "@/app/actions";
import { calculateLoan, money, splitInstallments } from "@/lib/finance";
import type { Client } from "@/lib/types";

export function LoanForm({ clients, demo=false }: { clients: Client[]; demo?: boolean }) {
  const [open,setOpen]=useState(false);
  const [pending,start]=useTransition();
  const [error,setError]=useState("");
  const [principal,setPrincipal]=useState(1000);
  const [returnValue,setReturnValue]=useState(30);
  const [type,setType]=useState<"percentage"|"fixed">("percentage");
  const [count,setCount]=useState(5);
  const [frequency,setFrequency]=useState("MENSAL");
  const [customDate1,setCustomDate1]=useState("");
  const [customDate2,setCustomDate2]=useState("");
  const custom=frequency==="PERSONALIZADO";
  const displayCount=custom?2:count;
  const calc=useMemo(()=>calculateLoan(principal||0,type,returnValue||0),[principal,type,returnValue]);
  const installments=splitInstallments(calc.totalReceivable,displayCount||1);

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
        <div className="field"><label>Forma de pagamento</label><select className="select" name="payment_frequency" value={frequency} onChange={e=>{setFrequency(e.target.value);if(e.target.value==="PERSONALIZADO")setCount(2)}}><option value="UNICO">Pagamento único</option><option value="DIARIO">Diário</option><option value="SEMANAL">Semanal</option><option value="QUINZENAL">Quinzenal</option><option value="MENSAL">Mensal</option><option value="PERSONALIZADO">Datas fixas (2 parcelas)</option></select></div>
        {custom?<>
          <input type="hidden" name="installment_count" value="2"/><input type="hidden" name="first_due_date" value={customDate1}/>
          <div className="field"><label>Data da 1ª parcela *</label><input className="input" name="custom_due_date_1" type="date" value={customDate1} onChange={e=>setCustomDate1(e.target.value)} required/></div>
          <div className="field"><label>Data da 2ª parcela *</label><input className="input" name="custom_due_date_2" type="date" value={customDate2} onChange={e=>setCustomDate2(e.target.value)} required/></div>
        </>:<>
          <div className="field"><label>Número de parcelas</label><input className="input" name="installment_count" type="number" min="1" value={count} onChange={e=>setCount(Math.max(1,Number(e.target.value)))}/></div>
        </>}
        <div className="field"><label>Data do empréstimo *</label><input className="input" name="start_date" type="date" required/></div>
        {!custom&&<div className="field"><label>Primeiro pagamento *</label><input className="input" name="first_due_date" type="date" required/></div>}
        {custom&&<div className="field full"><div className="alert">Datas fixas: o empréstimo terá exatamente 2 parcelas, nas duas datas escolhidas acima.</div></div>}
        <div className="field full"><div className="card" style={{background:"#090c11"}}><div className="grid-equal"><div><div className="muted" style={{fontSize:11}}>Lucro esperado</div><strong>{money(calc.expectedProfit)}</strong></div><div><div className="muted" style={{fontSize:11}}>Total a receber</div><strong>{money(calc.totalReceivable)}</strong></div></div><div className="divider"/><div className="muted" style={{fontSize:12}}>{displayCount}x de aproximadamente <strong style={{color:"white"}}>{money(installments[0]||0)}</strong></div></div></div>
        {error&&<div className="field full"><div className="alert">{error}</div></div>}
        <div className="field full" style={{flexDirection:"row",justifyContent:"flex-end"}}><button type="button" className="btn secondary" onClick={()=>setOpen(false)}>Cancelar</button><button className="btn" disabled={pending||demo}>{pending?"Criando...":"Criar empréstimo"}</button></div>
      </form>
    </div></div>}
  </>;
}

"use client";
import { useState,useTransition } from "react";
import { registerInterestOnlyAction } from "@/app/interest-only-actions";
import { money } from "@/lib/finance";
import type { Installment } from "@/lib/types";

export function InterestOnlyForm({installments,demo=false}:{installments:Installment[];demo?:boolean}){
  const [open,setOpen]=useState(false),[pending,start]=useTransition(),[error,setError]=useState("");
  const [selected,setSelected]=useState("");
  const current=installments.find(i=>i.id===selected);
  const interest=current?.loan ? Number(current.loan.fixed_return_amount ?? (Number(current.loan.principal_amount||0)*Number(current.loan.return_percentage||0)/100)) : 0;
  const principal=current?.loan?.principal_amount;
  function submit(formData:FormData){
    setError("");
    start(async()=>{try{await registerInterestOnlyAction(formData);setOpen(false);setSelected("");}catch(e){setError(e instanceof Error?e.message:"Falha ao registrar juros");}});
  }
  const choices=installments.filter(i=>i.stored_status!=="CANCELADO"&&i.remaining_amount>0&&
    i.loan?.status==="ATIVO"&&i.loan?.principal_amount&&["UNICO","MENSAL"].includes(i.loan?.payment_frequency||""));
  return <>
    <button type="button" className="btn secondary" onClick={()=>setOpen(true)}>Pagou somente os juros</button>
    {open&&<div className="modal-backdrop"><div className="modal">
      <div className="section-title"><h2>Pagamento somente dos juros</h2><button type="button" className="icon-btn" onClick={()=>setOpen(false)}>Fechar</button></div>
      <p className="muted">Registra os juros deste ciclo como recebidos e renova o valor total devido para o próximo mês. O principal permanece emprestado e o mês quitado não fica atrasado. Disponível apenas para operações compatíveis com uma única parcela aberta.</p>
      <form action={submit} className="form-grid">
        <div className="field full"><label>Parcela</label><select className="select" name="installment_id" value={selected} onChange={e=>setSelected(e.target.value)} required>
          <option value="">Selecione</option>{choices.map(i=><option value={i.id} key={i.id}>{i.client?.name} · {i.loan?.loan_code} · {money(i.amount)}</option>)}
        </select></div>
        {current&&<div className="field full"><div className="alert">Juros previstos: {money(interest)}. Principal mantido: {money(principal)}. A nova parcela será de {money(current.amount)}. Sem amortização do principal.</div></div>}
        <div className="field"><label>Data do pagamento</label><input className="input" type="date" name="payment_date" required/></div>
        <div className="field"><label>Forma</label><select className="select" name="payment_method"><option value="PIX">PIX</option><option value="DINHEIRO">Dinheiro</option><option value="TRANSFERENCIA">Transferência</option><option value="OUTRO">Outro</option></select></div>
        <div className="field full"><label>Observação</label><input className="input" name="notes"/></div>
        {error&&<div className="alert field full">{error}</div>}
        <div className="field full"><button type="submit" className="btn" disabled={pending||demo||!selected}>{pending?"Registrando...":"Confirmar pagamento de juros"}</button></div>
      </form>
    </div></div>}
  </>;
}

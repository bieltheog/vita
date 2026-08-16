"use client";
import { useState, useTransition } from "react";
import { CreditCard, X } from "lucide-react";
import { registerPaymentAction } from "@/app/actions";
import { money } from "@/lib/finance";
import type { Installment } from "@/lib/types";

export function PaymentForm({ installments, demo=false, compact=false }: { installments: Installment[]; demo?: boolean; compact?: boolean }) {
  const [open,setOpen]=useState(false); const [pending,start]=useTransition(); const [error,setError]=useState("");
  async function submit(formData:FormData){setError("");start(async()=>{try{await registerPaymentAction(formData);setOpen(false)}catch(e){setError(e instanceof Error?e.message:"Erro ao registrar pagamento")}})}
  return <>
    <button className={compact?"btn secondary":"btn"} onClick={()=>setOpen(true)}><CreditCard size={16}/> Registrar pagamento</button>
    {open&&<div className="modal-backdrop"><div className="modal">
      <div className="section-title"><div><h2>Registrar pagamento</h2><div className="muted" style={{fontSize:12}}>O pagamento ficará ligado ao cliente, empréstimo e parcela.</div></div><button className="icon-btn" onClick={()=>setOpen(false)}><X size={17}/></button></div>
      {demo&&<div className="alert">Modo demonstração: configure o Supabase para registrar pagamentos.</div>}
      <form action={submit} className="form-grid" style={{marginTop:14}}>
        <div className="field full"><label>Parcela *</label><select className="select" name="installment_id" required><option value="">Selecione</option>{installments.filter(i=>Number(i.remaining_amount)>0).map(i=><option key={i.id} value={i.id}>{i.client?.name} · {i.loan?.loan_code} · {i.installment_number}/{i.loan?.installment_count} · saldo {money(i.remaining_amount)}</option>)}</select></div>
        <div className="field"><label>Valor recebido *</label><input className="input" name="amount" type="number" min="0.01" step="0.01" required/></div><div className="field"><label>Data *</label><input className="input" name="payment_date" type="date" required/></div>
        <div className="field"><label>Forma de pagamento</label><select className="select" name="payment_method"><option>PIX</option><option>DINHEIRO</option><option value="TRANSFERENCIA">Transferência</option><option>OUTRO</option></select></div><div className="field"><label>Observação</label><input className="input" name="notes"/></div>
        {error&&<div className="field full"><div className="alert">{error}</div></div>}
        <div className="field full" style={{flexDirection:"row",justifyContent:"flex-end"}}><button type="button" className="btn secondary" onClick={()=>setOpen(false)}>Cancelar</button><button className="btn" disabled={pending||demo}>{pending?"Confirmando...":"Confirmar pagamento"}</button></div>
      </form>
    </div></div>}
  </>;
}

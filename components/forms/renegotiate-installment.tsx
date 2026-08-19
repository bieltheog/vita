"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, X } from "lucide-react";
import { renegotiateInstallmentAction } from "@/app/operations-actions";
import { money } from "@/lib/finance";
import type { Installment } from "@/lib/types";

export function RenegotiateInstallment({ installment, compact=false }: { installment: Installment; compact?: boolean }) {
  const router = useRouter();
  const [open,setOpen]=useState(false);
  const [pending,start]=useTransition();
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");

  async function submit(formData:FormData){
    setError("");setMessage("");
    start(async()=>{
      const result=await renegotiateInstallmentAction(formData);
      if(!result.ok){setError(result.error);return;}
      setMessage(result.message||"Parcela atualizada.");
      router.refresh();
      setTimeout(()=>setOpen(false),500);
    });
  }

  return <>
    <button type="button" className={compact?"icon-btn":"btn secondary"} onClick={()=>setOpen(true)} title="Renegociar parcela"><CalendarClock size={16}/>{compact?null:"Renegociar"}</button>
    {open&&<div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setOpen(false)}}><div className="modal" style={{maxWidth:590}}>
      <div className="section-title"><div><div className="eyebrow">Renegociação</div><h2>Parcela {installment.installment_number}/{installment.loan?.installment_count}</h2><div className="muted" style={{fontSize:12}}>{installment.client?.name} · {installment.loan?.loan_code}</div></div><button type="button" className="icon-btn" onClick={()=>setOpen(false)}><X size={17}/></button></div>
      <div className="card" style={{marginTop:14,background:"#090c11"}}><div className="grid-equal"><div><div className="muted" style={{fontSize:11}}>Vencimento atual</div><strong>{installment.due_date}</strong></div><div><div className="muted" style={{fontSize:11}}>Valor atual</div><strong>{money(installment.amount)}</strong></div><div><div className="muted" style={{fontSize:11}}>Já recebido</div><strong>{money(installment.amount_paid)}</strong></div></div></div>
      <form action={submit} className="form-grid" style={{marginTop:14}}>
        <input type="hidden" name="installment_id" value={installment.id}/>
        <div className="field"><label>Nova data *</label><input className="input" type="date" name="new_due_date" defaultValue={installment.due_date} required/></div>
        <div className="field"><label>Novo valor *</label><input className="input" type="number" name="new_amount" min={Number(installment.amount_paid)||0.01} step="0.01" defaultValue={Number(installment.amount).toFixed(2)} required/></div>
        <div className="field full"><label>Motivo</label><input className="input" name="reason" placeholder="Ex.: cliente pediu mudança de vencimento"/></div>
        <div className="field full"><div className="alert">A data original fica preservada no histórico. Se o valor mudar, o total a receber e o lucro previsto do empréstimo são recalculados automaticamente.</div></div>
        {error&&<div className="field full"><div className="alert">{error}</div></div>}
        {message&&<div className="field full"><div className="alert">{message}</div></div>}
        <div className="field full" style={{flexDirection:"row",justifyContent:"flex-end"}}><button type="button" className="btn secondary" onClick={()=>setOpen(false)}>Cancelar</button><button className="btn" disabled={pending}>{pending?"Salvando...":"Salvar renegociação"}</button></div>
      </form>
    </div></div>}
  </>;
}

"use client";

import { useState, useTransition } from "react";
import { Ban } from "lucide-react";
import { cancelLoanAction } from "@/app/loan-cancel-actions";

export function CancelLoanButton({ loanId, loanCode, disabled=false }: { loanId: string; loanCode: string; disabled?: boolean }) {
  const [open,setOpen]=useState(false);
  const [pending,start]=useTransition();
  const [error,setError]=useState("");

  function confirm(){
    setError("");
    const form=new FormData();
    form.set("loan_id",loanId);
    start(async()=>{
      const result=await cancelLoanAction(form);
      if(!result.ok){setError(result.error);return;}
      setOpen(false);
    });
  }

  if(disabled) return null;

  return <>
    <button className="icon-btn" type="button" title="Cancelar empréstimo" onClick={()=>setOpen(true)}><Ban size={15}/></button>
    {open&&<div className="modal-backdrop"><div className="modal" style={{maxWidth:460}}>
      <div className="section-title"><div><h2>Cancelar empréstimo</h2><div className="muted" style={{fontSize:12}}>{loanCode}</div></div><button className="icon-btn" type="button" onClick={()=>setOpen(false)}>×</button></div>
      <div className="alert" style={{marginTop:14}}>
        O empréstimo será marcado como <strong>CANCELADO</strong>. Os pagamentos que já foram registrados e o histórico serão preservados. As parcelas que ainda não foram pagas deixarão de entrar nos cálculos financeiros.
      </div>
      {error&&<div className="alert" style={{marginTop:10}}>{error}</div>}
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
        <button className="btn secondary" type="button" onClick={()=>setOpen(false)} disabled={pending}>Voltar</button>
        <button className="btn" type="button" onClick={confirm} disabled={pending}>{pending?"Cancelando...":"Confirmar cancelamento"}</button>
      </div>
    </div></div>}
  </>;
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X } from "lucide-react";
import { deleteLoanAction } from "@/app/delete-loan-actions";
import { money } from "@/lib/finance";

export function DeleteLoanButton({
  loanId,
  loanCode,
  clientName,
  principal,
  hasPayments=false,
  compact=false,
  redirectAfter=false,
}: {
  loanId: string;
  loanCode: string;
  clientName?: string | null;
  principal?: number | string;
  hasPayments?: boolean;
  compact?: boolean;
  redirectAfter?: boolean;
}) {
  const router=useRouter();
  const [open,setOpen]=useState(false);
  const [confirmation,setConfirmation]=useState("");
  const [error,setError]=useState("");
  const [pending,start]=useTransition();
  const confirmed=confirmation.trim()===loanCode;

  function close(){
    if(pending)return;
    setOpen(false);setConfirmation("");setError("");
  }

  function remove(){
    if(!confirmed)return;
    setError("");
    const fd=new FormData();
    fd.set("loan_id",loanId);
    fd.set("confirmation",confirmation.trim());
    start(async()=>{
      const result=await deleteLoanAction(fd);
      if(!result.ok){setError(result.error);return;}
      setOpen(false);
      if(redirectAfter){router.push("/emprestimos");}
      router.refresh();
    });
  }

  return <>
    {compact
      ? <button type="button" className="icon-btn" title="Excluir empréstimo" onClick={()=>setOpen(true)} style={{color:"#ff6b75"}}><Trash2 size={15}/></button>
      : <button type="button" className="btn secondary" onClick={()=>setOpen(true)} style={{color:"#ff7a84",borderColor:"rgba(255,98,109,.35)"}}><Trash2 size={16}/>Excluir empréstimo</button>}

    {open&&<div className="modal-backdrop"><div className="modal" style={{maxWidth:520}}>
      <div className="section-title">
        <div><div className="eyebrow" style={{color:"#ff7a84"}}>Zona de risco</div><h2>Excluir {loanCode}?</h2><div className="muted" style={{fontSize:12}}>{clientName||"Cliente"}{principal!=null?` · ${money(Number(principal))} emprestados`:""}</div></div>
        <button type="button" className="icon-btn" onClick={close}><X size={17}/></button>
      </div>

      <div className="alert" style={{marginTop:16,borderColor:"rgba(255,98,109,.4)",color:"#ff9aa2"}}>
        <strong>Essa exclusão é permanente.</strong> O empréstimo, parcelas, adicionais e dados financeiros ligados a ele deixam de entrar no Dashboard, Meu Caixa, calendário e relatórios.
      </div>

      {hasPayments&&<div className="alert" style={{marginTop:12,borderColor:"rgba(255,181,71,.4)",color:"#ffd18a"}}>
        <strong>Este empréstimo já possui pagamento registrado.</strong> Ao excluir, os pagamentos vinculados também serão apagados e os totais recebidos/caixa serão recalculados sem eles.
      </div>}

      <div className="field" style={{marginTop:16}}>
        <label>Digite <strong>{loanCode}</strong> para confirmar</label>
        <input className="input" value={confirmation} onChange={e=>setConfirmation(e.target.value)} autoComplete="off" placeholder={loanCode}/>
      </div>

      {error&&<div className="alert" style={{marginTop:12,borderColor:"rgba(255,98,109,.4)",color:"#ff9aa2"}}>{error}</div>}

      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:18,flexWrap:"wrap"}}>
        <button type="button" className="btn secondary" onClick={close} disabled={pending}>Cancelar</button>
        <button type="button" className="btn" onClick={remove} disabled={!confirmed||pending} style={{background:"#d93645",borderColor:"#d93645"}}>
          <Trash2 size={16}/>{pending?"Excluindo...":"Excluir permanentemente"}
        </button>
      </div>
    </div></div>}
  </>;
}

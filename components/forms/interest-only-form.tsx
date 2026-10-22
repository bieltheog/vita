"use client";
import { useState,useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { registerInterestOnlyAction } from "@/app/interest-only-actions";
import { money } from "@/lib/finance";
import type { Installment } from "@/lib/types";

export function InterestOnlyForm({installments,demo=false}:{installments:Installment[];demo?:boolean}){
  const router=useRouter();
  const [open,setOpen]=useState(false),[pending,start]=useTransition(),[error,setError]=useState("");
  const [selected,setSelected]=useState("");
  const current=installments.find(i=>i.id===selected);
  const interest=current?.loan ? Number(current.loan.fixed_return_amount ?? (Number(current.loan.principal_amount||0)*Number(current.loan.return_percentage||0)/100)) : 0;
  const principal=current?.loan?.principal_amount;
  function submit(formData:FormData){
    setError("");
    start(async()=>{try{await registerInterestOnlyAction(formData);setOpen(false);setSelected("");router.refresh();}catch(e){setError(e instanceof Error?e.message:"Falha ao registrar juros");}});
  }
  const openCountByLoan=new Map<string,number>();
  installments
    .filter(i=>i.stored_status!=="CANCELADO"&&Number(i.remaining_amount)>0&&i.loan?.status==="ATIVO")
    .forEach(i=>openCountByLoan.set(i.loan_id,(openCountByLoan.get(i.loan_id)||0)+1));
  const choices=installments.filter(i=>{
    const loan=i.loan;
    if(i.stored_status==="CANCELADO"||Number(i.remaining_amount)<=0||loan?.status!=="ATIVO"||!loan?.principal_amount)return false;
    if(!["UNICO","MENSAL"].includes(loan.payment_frequency||""))return false;
    if((openCountByLoan.get(i.loan_id)||0)!==1)return false;
    if(Number(i.amount_paid)>0.005||Math.abs(Number(i.remaining_amount)-Number(i.amount))>0.005)return false;
    const interest=Number(loan.fixed_return_amount ?? (Number(loan.principal_amount||0)*Number(loan.return_percentage||0)/100));
    return interest>0&&Math.abs(Number(i.amount)-(Number(loan.principal_amount||0)+interest))<=0.01;
  });
  return <>
    <button type="button" className="btn secondary" onClick={()=>setOpen(true)} disabled={demo||choices.length===0} title={choices.length===0?"Nenhuma parcela compatível com pagamento somente de juros":undefined}>Somente juros</button>
    {open&&<div className="modal-backdrop"><div className="modal">
      <div className="section-title"><h2>Pagamento somente dos juros</h2><button type="button" className="icon-btn" title="Fechar" onClick={()=>setOpen(false)}><X size={17}/></button></div>
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

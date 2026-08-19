"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Search, Undo2 } from "lucide-react";
import { registerPaymentSafeAction, markInstallmentUnpaidSafeAction } from "@/app/operations-actions";
import { effectiveInstallmentStatus, money } from "@/lib/finance";
import { StatusBadge } from "@/components/ui/status-badge";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";
import { RenegotiateInstallment } from "@/components/forms/renegotiate-installment";
import type { Installment } from "@/lib/types";

function normalize(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()}

export function TodayCollections({ today, overdue, dateKey }: { today: Installment[]; overdue: Installment[]; dateKey: string }) {
  const router=useRouter();
  const [query,setQuery]=useState("");
  const [pending,start]=useTransition();
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");

  const filteredToday=useMemo(()=>today.filter(row=>normalize(`${row.client?.name||""} ${row.loan?.loan_code||""}`).includes(normalize(query))),[today,query]);
  const filteredOverdue=useMemo(()=>overdue.filter(row=>normalize(`${row.client?.name||""} ${row.loan?.loan_code||""}`).includes(normalize(query))),[overdue,query]);

  async function pay(row:Installment, amount:number){
    setError("");setMessage("");
    const fd=new FormData();fd.set("installment_id",row.id);fd.set("amount",String(amount));fd.set("payment_date",dateKey);fd.set("payment_method","PIX");
    start(async()=>{const result=await registerPaymentSafeAction(fd);if(!result.ok){setError(result.error);return;}setMessage(result.message||"Pagamento registrado.");router.refresh();});
  }
  async function undo(row:Installment){
    if(!window.confirm("Desfazer os pagamentos desta parcela? O histórico será preservado."))return;
    setError("");setMessage("");const fd=new FormData();fd.set("installment_id",row.id);
    start(async()=>{const result=await markInstallmentUnpaidSafeAction(fd);if(!result.ok){setError(result.error);return;}setMessage(result.message||"Pagamento desfeito.");router.refresh();});
  }

  function messageFor(row:Installment){const late=effectiveInstallmentStatus(row)==="ATRASADO";return `Olá, ${row.client?.name||""}! ${late?"Identificamos uma parcela em aberto":"Sua parcela vence hoje"} no valor de ${money(row.remaining_amount)} (${row.loan?.loan_code||"empréstimo"}). Se já realizou o pagamento, desconsidere esta mensagem.`}

  function Row({row}:{row:Installment}){const status=effectiveInstallmentStatus(row);const remaining=Number(row.remaining_amount);const paid=Number(row.amount_paid)>0;return <div className="card" style={{padding:14}}>
    <div className="section-title"><div className="person"><div className="avatar">{row.client?.name?.[0]||"?"}</div><div><div className="person-name">{row.client?.name}</div><div className="person-meta">{row.loan?.loan_code} · parcela {row.installment_number}/{row.loan?.installment_count} · {row.due_date}</div></div></div><StatusBadge status={status}/></div>
    <div className="grid-equal" style={{marginTop:12}}><div><div className="muted" style={{fontSize:11}}>Parcela</div><strong>{money(row.amount)}</strong></div><div><div className="muted" style={{fontSize:11}}>Recebido</div><strong style={{color:"var(--green)"}}>{money(row.amount_paid)}</strong></div><div><div className="muted" style={{fontSize:11}}>Saldo</div><strong>{money(row.remaining_amount)}</strong></div></div>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:13}}><WhatsAppButton phone={row.client?.whatsapp||row.client?.phone} message={messageFor(row)}/>{remaining>0&&<button type="button" className="btn" disabled={pending} onClick={()=>pay(row,remaining)}><CreditCard size={16}/> Quitar</button>}<RenegotiateInstallment installment={row}/>{paid&&<button type="button" className="btn secondary" disabled={pending} onClick={()=>undo(row)}><Undo2 size={16}/> Não pago</button>}</div>
  </div>}

  const todayTotal=today.reduce((s,r)=>s+Number(r.amount),0), todayRemaining=today.reduce((s,r)=>s+Number(r.remaining_amount),0), lateTotal=overdue.reduce((s,r)=>s+Number(r.remaining_amount),0);
  return <>
    <div className="kpi-strip"><div className="kpi-mini"><span className="muted">Previsto hoje</span><strong>{money(todayTotal)}</strong></div><div className="kpi-mini"><span className="muted">Falta receber hoje</span><strong>{money(todayRemaining)}</strong></div><div className="kpi-mini"><span className="muted">Atrasado anterior</span><strong style={{color:"var(--red)"}}>{money(lateTotal)}</strong></div><div className="kpi-mini"><span className="muted">Cobranças</span><strong>{today.length+overdue.length}</strong></div></div>
    <div className="search-box" style={{maxWidth:520,marginBottom:16}}><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar cliente ou empréstimo..."/></div>
    {error&&<div className="alert" style={{marginBottom:14}}>{error}</div>}{message&&<div className="alert" style={{marginBottom:14}}>{message}</div>}
    <div className="grid-equal"><div><div className="section-title" style={{marginBottom:10}}><h2>Vencem hoje</h2><span className="badge blue">{filteredToday.length}</span></div><div className="list">{filteredToday.length?filteredToday.map(r=><Row key={r.id} row={r}/>):<div className="card empty">Nenhuma cobrança prevista para hoje.</div>}</div></div><div><div className="section-title" style={{marginBottom:10}}><h2>Atrasadas</h2><span className="badge gray">{filteredOverdue.length}</span></div><div className="list">{filteredOverdue.length?filteredOverdue.map(r=><Row key={r.id} row={r}/>):<div className="card empty">Nenhuma parcela atrasada.</div>}</div></div></div>
  </>;
}

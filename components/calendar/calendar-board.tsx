"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CreditCard, Undo2, X } from "lucide-react";
import { effectiveInstallmentStatus, money } from "@/lib/finance";
import { StatusBadge } from "@/components/ui/status-badge";
import { registerPaymentAction } from "@/app/actions";
import { markInstallmentUnpaidAction } from "@/app/calendar-actions";
import type { Installment } from "@/lib/types";

export function CalendarBoard({ installments }: { installments: Installment[] }) {
  const router = useRouter();
  const [month,setMonth]=useState(new Date());
  const [selectedDate,setSelectedDate]=useState<string|null>(null);
  const [pending,startTransition]=useTransition();
  const [error,setError]=useState("");
  const todayKey=format(new Date(),"yyyy-MM-dd");

  const days=useMemo(()=>eachDayOfInterval({start:startOfWeek(startOfMonth(month),{weekStartsOn:0}),end:endOfWeek(endOfMonth(month),{weekStartsOn:0})}),[month]);
  const monthKey=format(month,"yyyy-MM");
  const monthStartKey=format(startOfMonth(month),"yyyy-MM-dd");
  const monthRows=installments.filter(i=>i.due_date.startsWith(monthKey));
  const priorOverdue=installments.filter(i=>i.due_date<monthStartKey&&effectiveInstallmentStatus(i)==="ATRASADO").sort((a,b)=>a.due_date.localeCompare(b.due_date));
  const selectedRows=selectedDate ? installments.filter(i=>i.due_date===selectedDate).sort((a,b)=>a.installment_number-b.installment_number) : [];

  const totals={
    previsto:monthRows.reduce((s,i)=>s+Number(i.amount),0),
    recebido:monthRows.reduce((s,i)=>s+Number(i.amount_paid),0),
    pendente:monthRows.reduce((s,i)=>s+Number(i.remaining_amount),0),
    atrasado:monthRows.filter(i=>effectiveInstallmentStatus(i)==="ATRASADO").reduce((s,i)=>s+Number(i.remaining_amount),0)+priorOverdue.reduce((s,i)=>s+Number(i.remaining_amount),0),
  };

  function openDay(date:string){setError("");setSelectedDate(date)}

  async function submitPayment(formData:FormData){
    setError("");
    startTransition(async()=>{
      try{
        await registerPaymentAction(formData);
        router.refresh();
      }catch(e){
        setError(e instanceof Error?e.message:"Erro ao registrar pagamento.");
      }
    });
  }

  function undoPayment(installmentId:string){
    if(!window.confirm("Marcar esta parcela como não paga? Os pagamentos serão estornados, mas continuarão salvos no histórico.")) return;
    setError("");
    const formData=new FormData();
    formData.set("installment_id",installmentId);
    startTransition(async()=>{
      try{
        await markInstallmentUnpaidAction(formData);
        router.refresh();
      }catch(e){
        setError(e instanceof Error?e.message:"Erro ao desfazer pagamento.");
      }
    });
  }

  return <>
    <div className="kpi-strip"><div className="kpi-mini"><span className="muted">Previsto</span><strong>{money(totals.previsto)}</strong></div><div className="kpi-mini"><span className="muted">Recebido</span><strong>{money(totals.recebido)}</strong></div><div className="kpi-mini"><span className="muted">Pendente</span><strong>{money(totals.pendente)}</strong></div><div className="kpi-mini"><span className="muted">Atrasado</span><strong style={{color:"var(--red)"}}>{money(totals.atrasado)}</strong></div></div>

    {priorOverdue.length>0&&<div className="card" style={{marginBottom:16}}><div className="section-title"><div><h2>Atrasados de meses anteriores</h2><div className="muted" style={{fontSize:12}}>Clique em uma pendência para abrir o dia e registrar o pagamento.</div></div></div><div className="list">{priorOverdue.map(i=><button type="button" className="list-row" key={`prior-${i.id}`} onClick={()=>openDay(i.due_date)} style={{width:"100%",textAlign:"left",cursor:"pointer",border:0}}><div className="person"><div className="avatar">{i.client?.name?.[0]||"?"}</div><div><div className="person-name">{i.client?.name}</div><div className="person-meta">{format(new Date(i.due_date+"T12:00:00"),"dd/MM/yyyy")} · {i.loan?.loan_code} · parcela {i.installment_number}/{i.loan?.installment_count}</div></div></div><div style={{textAlign:"right"}}><strong>{money(i.remaining_amount)}</strong><div style={{marginTop:5}}><StatusBadge status={effectiveInstallmentStatus(i)}/></div></div></button>)}</div></div>}

    <div className="card">
      <div className="section-title"><div><h2 style={{textTransform:"capitalize"}}>{format(month,"MMMM 'de' yyyy",{locale:ptBR})}</h2><div className="muted" style={{fontSize:12}}>Clique em qualquer dia para ver e atualizar os recebimentos.</div></div><div style={{display:"flex",gap:7}}><button className="icon-btn" onClick={()=>setMonth(subMonths(month,1))}><ChevronLeft size={17}/></button><button className="icon-btn" onClick={()=>setMonth(addMonths(month,1))}><ChevronRight size={17}/></button></div></div>
      <div className="calendar-grid">{["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(d=><div key={d} className="calendar-head">{d}</div>)}{days.map(day=>{const key=format(day,"yyyy-MM-dd"); const rows=installments.filter(i=>i.due_date===key);return <button type="button" key={key} className="calendar-day" onClick={()=>openDay(key)} style={{opacity:isSameMonth(day,month)?1:.35,cursor:"pointer",textAlign:"left",border:"inherit",font:"inherit",color:"inherit"}}><div className="day-number">{format(day,"d")}</div>{rows.slice(0,4).map(i=>{const status=effectiveInstallmentStatus(i); return <div className={`calendar-item ${status}`} key={i.id} title={`${i.client?.name} ${money(i.remaining_amount)}`}>{i.client?.name} · {money(i.remaining_amount)}</div>})}{rows.length>4&&<div className="muted" style={{fontSize:10,marginTop:5}}>+{rows.length-4} recebimentos</div>}</button>})}</div>
      <div className="list" style={{marginTop:10}}>{[...monthRows].sort((a,b)=>a.due_date.localeCompare(b.due_date)).map(i=><button type="button" className="list-row" key={i.id} onClick={()=>openDay(i.due_date)} style={{width:"100%",textAlign:"left",cursor:"pointer",border:0}}><div className="person"><div className="avatar">{i.client?.name?.[0]||"?"}</div><div><div className="person-name">{i.client?.name}</div><div className="person-meta">{format(new Date(i.due_date+"T12:00:00"),"dd/MM/yyyy")} · {i.loan?.loan_code} · parcela {i.installment_number}/{i.loan?.installment_count}</div></div></div><div style={{textAlign:"right"}}><strong>{money(i.remaining_amount)}</strong><div style={{marginTop:5}}><StatusBadge status={effectiveInstallmentStatus(i)}/></div></div></button>)}</div>
    </div>

    {selectedDate&&<div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setSelectedDate(null)}}><div className="modal" style={{maxWidth:760}}>
      <div className="section-title"><div><div className="eyebrow">Recebimentos do dia</div><h2 style={{textTransform:"capitalize"}}>{format(new Date(selectedDate+"T12:00:00"),"dd 'de' MMMM 'de' yyyy",{locale:ptBR})}</h2><div className="muted" style={{fontSize:12}}>{selectedRows.length} {selectedRows.length===1?"parcela":"parcelas"} programada{selectedRows.length===1?"":"s"}.</div></div><button className="icon-btn" onClick={()=>setSelectedDate(null)}><X size={17}/></button></div>

      {error&&<div className="alert" style={{marginTop:14}}>{error}</div>}
      {selectedRows.length===0&&<div className="card" style={{marginTop:14,textAlign:"center"}}><strong>Nenhum recebimento neste dia.</strong><div className="muted" style={{fontSize:12,marginTop:5}}>Escolha outro dia no calendário.</div></div>}

      <div className="list" style={{marginTop:14}}>{selectedRows.map(i=>{const status=effectiveInstallmentStatus(i);const hasPaid=Number(i.amount_paid)>0;const remaining=Number(i.remaining_amount);return <div className="card" key={`manage-${i.id}`} style={{padding:14}}>
        <div className="section-title"><div className="person"><div className="avatar">{i.client?.name?.[0]||"?"}</div><div><div className="person-name">{i.client?.name}</div><div className="person-meta">{i.loan?.loan_code} · parcela {i.installment_number}/{i.loan?.installment_count}</div></div></div><StatusBadge status={status}/></div>
        <div className="grid-equal" style={{marginTop:12}}><div><div className="muted" style={{fontSize:11}}>Valor da parcela</div><strong>{money(i.amount)}</strong></div><div><div className="muted" style={{fontSize:11}}>Já recebido</div><strong style={{color:"var(--green)"}}>{money(i.amount_paid)}</strong></div><div><div className="muted" style={{fontSize:11}}>Saldo</div><strong>{money(i.remaining_amount)}</strong></div></div>

        {remaining>0&&<form key={`payment-${i.id}-${i.remaining_amount}`} action={submitPayment} className="form-grid" style={{marginTop:14}}>
          <input type="hidden" name="installment_id" value={i.id}/>
          <div className="field"><label>Valor recebido</label><input className="input" name="amount" type="number" min="0.01" max={remaining} step="0.01" defaultValue={remaining.toFixed(2)} required/></div>
          <div className="field"><label>Data do pagamento</label><input className="input" name="payment_date" type="date" defaultValue={todayKey} required/></div>
          <div className="field"><label>Forma de pagamento</label><select className="select" name="payment_method" defaultValue="PIX"><option value="PIX">PIX</option><option value="DINHEIRO">Dinheiro</option><option value="TRANSFERENCIA">Transferência</option><option value="OUTRO">Outro</option></select></div>
          <div className="field"><label>Observação</label><input className="input" name="notes" placeholder="Opcional"/></div>
          <div className="field full"><div className="muted" style={{fontSize:11}}>Para <strong>marcar como pago</strong>, deixe o valor igual ao saldo. Para pagamento parcial, informe um valor menor.</div></div>
          <div className="field full" style={{alignItems:"flex-end"}}><button className="btn" disabled={pending}><CreditCard size={16}/>{pending?"Salvando...":remaining===Number(i.amount)?"Marcar como pago":"Registrar pagamento"}</button></div>
        </form>}

        {hasPaid&&<div style={{display:"flex",justifyContent:"flex-end",marginTop:12}}><button type="button" className="btn secondary" disabled={pending} onClick={()=>undoPayment(i.id)}><Undo2 size={16}/> Marcar como não pago</button></div>}
      </div>})}</div>
    </div></div>}
  </>;
}

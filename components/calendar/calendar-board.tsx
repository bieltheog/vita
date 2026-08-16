"use client";
import { useMemo, useState } from "react";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { effectiveInstallmentStatus, money } from "@/lib/finance";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Installment } from "@/lib/types";

export function CalendarBoard({ installments }: { installments: Installment[] }) {
  const [month,setMonth]=useState(new Date());
  const days=useMemo(()=>eachDayOfInterval({start:startOfWeek(startOfMonth(month),{weekStartsOn:0}),end:endOfWeek(endOfMonth(month),{weekStartsOn:0})}),[month]);
  const monthKey=format(month,"yyyy-MM");
  const monthStartKey=format(startOfMonth(month),"yyyy-MM-dd");
  const monthRows=installments.filter(i=>i.due_date.startsWith(monthKey));
  const priorOverdue=installments.filter(i=>i.due_date<monthStartKey&&effectiveInstallmentStatus(i)==="ATRASADO").sort((a,b)=>a.due_date.localeCompare(b.due_date));
  const totals={
    previsto:monthRows.reduce((s,i)=>s+Number(i.amount),0),
    recebido:monthRows.reduce((s,i)=>s+Number(i.amount_paid),0),
    pendente:monthRows.reduce((s,i)=>s+Number(i.remaining_amount),0),
    atrasado:monthRows.filter(i=>effectiveInstallmentStatus(i)==="ATRASADO").reduce((s,i)=>s+Number(i.remaining_amount),0)+priorOverdue.reduce((s,i)=>s+Number(i.remaining_amount),0),
  };
  return <>
    <div className="kpi-strip"><div className="kpi-mini"><span className="muted">Previsto</span><strong>{money(totals.previsto)}</strong></div><div className="kpi-mini"><span className="muted">Recebido</span><strong>{money(totals.recebido)}</strong></div><div className="kpi-mini"><span className="muted">Pendente</span><strong>{money(totals.pendente)}</strong></div><div className="kpi-mini"><span className="muted">Atrasado</span><strong style={{color:"var(--red)"}}>{money(totals.atrasado)}</strong></div></div>
    {priorOverdue.length>0&&<div className="card" style={{marginBottom:16}}><div className="section-title"><div><h2>Atrasados de meses anteriores</h2><div className="muted" style={{fontSize:12}}>Pendências antigas continuam visíveis mesmo fora do mês atual.</div></div></div><div className="list">{priorOverdue.map(i=><div className="list-row" key={`prior-${i.id}`}><div className="person"><div className="avatar">{i.client?.name?.[0]||"?"}</div><div><div className="person-name">{i.client?.name}</div><div className="person-meta">{format(new Date(i.due_date+"T12:00:00"),"dd/MM/yyyy")} · {i.loan?.loan_code} · parcela {i.installment_number}/{i.loan?.installment_count}</div></div></div><div style={{textAlign:"right"}}><strong>{money(i.remaining_amount)}</strong><div style={{marginTop:5}}><StatusBadge status={effectiveInstallmentStatus(i)}/></div></div></div>)}</div></div>}
    <div className="card">
      <div className="section-title"><div><h2 style={{textTransform:"capitalize"}}>{format(month,"MMMM 'de' yyyy",{locale:ptBR})}</h2><div className="muted" style={{fontSize:12}}>Mês no desktop · agenda no celular</div></div><div style={{display:"flex",gap:7}}><button className="icon-btn" onClick={()=>setMonth(subMonths(month,1))}><ChevronLeft size={17}/></button><button className="icon-btn" onClick={()=>setMonth(addMonths(month,1))}><ChevronRight size={17}/></button></div></div>
      <div className="calendar-grid">{["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(d=><div key={d} className="calendar-head">{d}</div>)}{days.map(day=>{const key=format(day,"yyyy-MM-dd"); const rows=installments.filter(i=>i.due_date===key);return <div key={key} className="calendar-day" style={{opacity:isSameMonth(day,month)?1:.35}}><div className="day-number">{format(day,"d")}</div>{rows.slice(0,4).map(i=>{const status=effectiveInstallmentStatus(i); return <div className={`calendar-item ${status}`} key={i.id} title={`${i.client?.name} ${money(i.remaining_amount)}`}>{i.client?.name} · {money(i.remaining_amount)}</div>})}{rows.length>4&&<div className="muted" style={{fontSize:10,marginTop:5}}>+{rows.length-4} recebimentos</div>}</div>})}</div>
      <div className="list" style={{marginTop:10}}>{[...monthRows].sort((a,b)=>a.due_date.localeCompare(b.due_date)).map(i=><div className="list-row" key={i.id}><div className="person"><div className="avatar">{i.client?.name?.[0]||"?"}</div><div><div className="person-name">{i.client?.name}</div><div className="person-meta">{format(new Date(i.due_date+"T12:00:00"),"dd/MM/yyyy")} · {i.loan?.loan_code} · parcela {i.installment_number}/{i.loan?.installment_count}</div></div></div><div style={{textAlign:"right"}}><strong>{money(i.remaining_amount)}</strong><div style={{marginTop:5}}><StatusBadge status={effectiveInstallmentStatus(i)}/></div></div></div>)}</div>
    </div>
  </>;
}

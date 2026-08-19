"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, CreditCard, RotateCcw, Undo2, X } from "lucide-react";
import { effectiveInstallmentStatus, money } from "@/lib/finance";
import { brazilDateKey } from "@/lib/date";
import { StatusBadge } from "@/components/ui/status-badge";
import { registerPaymentSafeAction, markInstallmentUnpaidSafeAction } from "@/app/operations-actions";
import { payCashDebtAction, unpayCashDebtAction } from "@/app/cash-actions";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";
import { RenegotiateInstallment } from "@/components/forms/renegotiate-installment";
import type { CashDebt, Installment } from "@/lib/types";

export function CalendarBoard({ installments, debts=[] }: { installments: Installment[]; debts?: CashDebt[] }) {
  const router = useRouter();
  const [month,setMonth]=useState(new Date());
  const [selectedDate,setSelectedDate]=useState<string|null>(null);
  const [pending,startTransition]=useTransition();
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const todayKey=brazilDateKey();

  const days=useMemo(()=>eachDayOfInterval({start:startOfWeek(startOfMonth(month),{weekStartsOn:0}),end:endOfWeek(endOfMonth(month),{weekStartsOn:0})}),[month]);
  const monthKey=format(month,"yyyy-MM");
  const monthStartKey=format(startOfMonth(month),"yyyy-MM-dd");
  const monthRows=installments.filter(i=>i.due_date.startsWith(monthKey));
  const monthDebts=debts.filter(d=>d.status!=="CANCELADO"&&d.due_date.startsWith(monthKey));
  const priorOverdue=installments.filter(i=>i.due_date<monthStartKey&&effectiveInstallmentStatus(i,todayKey)==="ATRASADO").sort((a,b)=>a.due_date.localeCompare(b.due_date));
  const priorDebtOverdue=debts.filter(d=>d.status==="PENDENTE"&&d.due_date<monthStartKey&&d.due_date<todayKey).sort((a,b)=>a.due_date.localeCompare(b.due_date));
  const selectedRows=selectedDate ? installments.filter(i=>i.due_date===selectedDate).sort((a,b)=>a.installment_number-b.installment_number) : [];
  const selectedDebts=selectedDate ? debts.filter(d=>d.status!=="CANCELADO"&&d.due_date===selectedDate) : [];
  const selectedDebtPending=selectedDebts.filter(d=>d.status==="PENDENTE").reduce((s,d)=>s+Number(d.amount),0);
  const selectedTotals={
    previsto:selectedRows.reduce((s,i)=>s+Number(i.amount),0),
    recebido:selectedRows.reduce((s,i)=>s+Number(i.amount_paid),0),
    saldo:selectedRows.reduce((s,i)=>s+Number(i.remaining_amount),0),
    dividas:selectedDebtPending,
  };

  const monthPending=monthRows.reduce((s,i)=>s+Number(i.remaining_amount),0);
  const monthDebtPending=monthDebts.filter(d=>d.status==="PENDENTE").reduce((s,d)=>s+Number(d.amount),0);
  const totals={
    previsto:monthRows.reduce((s,i)=>s+Number(i.amount),0),
    recebido:monthRows.reduce((s,i)=>s+Number(i.amount_paid),0),
    pendente:monthPending,
    dividas:monthDebtPending,
    liquido:monthPending-monthDebtPending,
    atrasado:monthRows.filter(i=>effectiveInstallmentStatus(i,todayKey)==="ATRASADO").reduce((s,i)=>s+Number(i.remaining_amount),0)+priorOverdue.reduce((s,i)=>s+Number(i.remaining_amount),0),
  };

  function openDay(date:string){setError("");setMessage("");setSelectedDate(date)}
  async function submitPayment(formData:FormData){setError("");setMessage("");startTransition(async()=>{const result=await registerPaymentSafeAction(formData);if(!result.ok){setError(result.error);return;}setMessage(result.message||"Pagamento registrado.");router.refresh();});}
  function undoPayment(installmentId:string){if(!window.confirm("Marcar esta parcela como não paga? Os pagamentos serão estornados, mas continuarão salvos no histórico."))return;setError("");setMessage("");const formData=new FormData();formData.set("installment_id",installmentId);startTransition(async()=>{const result=await markInstallmentUnpaidSafeAction(formData);if(!result.ok){setError(result.error);return;}setMessage(result.message||"Pagamento desfeito.");router.refresh();});}
  function payDebt(debtId:string,formData:FormData){setError("");setMessage("");formData.set("debt_id",debtId);startTransition(async()=>{const result=await payCashDebtAction(formData);if(!result.ok){setError(result.error);return;}setMessage(result.message||"Dívida marcada como paga.");router.refresh();});}
  function undoDebt(debtId:string){if(!window.confirm("Desfazer o pagamento desta dívida? O valor voltará ao caixa e o histórico será preservado."))return;const fd=new FormData();fd.set("debt_id",debtId);setError("");setMessage("");startTransition(async()=>{const result=await unpayCashDebtAction(fd);if(!result.ok){setError(result.error);return;}setMessage(result.message||"Pagamento da dívida desfeito.");router.refresh();});}
  function chargeMessage(i:Installment){return `Olá, ${i.client?.name||""}! Sua parcela de ${money(i.remaining_amount)} do empréstimo ${i.loan?.loan_code||""} vence em ${i.due_date}. Se já pagou, desconsidere.`}

  return <>
    <div className="kpi-strip financial-kpis">
      <div className="kpi-mini"><span className="muted">A receber no mês</span><strong>{money(totals.pendente)}</strong></div>
      <div className="kpi-mini"><span className="muted">Recebido</span><strong className="money-positive">{money(totals.recebido)}</strong></div>
      <div className="kpi-mini"><span className="muted">Dívidas a pagar</span><strong className="money-negative">{money(totals.dividas)}</strong></div>
      <div className="kpi-mini featured"><span className="muted">Líquido previsto</span><strong className={totals.liquido<0?"money-negative":""}>{money(totals.liquido)}</strong></div>
      <div className="kpi-mini"><span className="muted">Recebimentos atrasados</span><strong className="money-negative">{money(totals.atrasado)}</strong></div>
    </div>
    <div className="card calendar-legend"><div className="financial-legend"><strong>Legenda</strong><span><i className="legend-dot income"/> Recebimento</span><span><i className="legend-dot debt"/> Dívida</span><span className="badge green">Pago</span><span className="badge yellow">Pendente</span><span className="badge red">Atrasado</span></div></div>

    {(priorOverdue.length>0||priorDebtOverdue.length>0)&&<div className="card attention-card" style={{marginBottom:16}}><div className="section-title"><div><h2>Pendências de meses anteriores</h2><div className="muted" style={{fontSize:12}}>Recebimentos atrasados e dívidas próprias que já venceram.</div></div><span className="badge red">{priorOverdue.length+priorDebtOverdue.length}</span></div><div className="list">
      {priorOverdue.map(i=><button type="button" className="list-row" key={`prior-${i.id}`} onClick={()=>openDay(i.due_date)} style={{width:"100%",textAlign:"left",cursor:"pointer",border:0}}><div className="person"><div className="avatar">{i.client?.name?.[0]||"?"}</div><div><div className="person-name">{i.client?.name}</div><div className="person-meta">Receber · {format(new Date(i.due_date+"T12:00:00"),"dd/MM/yyyy")} · {i.loan?.loan_code}</div></div></div><div style={{textAlign:"right"}}><strong className="money-positive">+ {money(i.remaining_amount)}</strong><div style={{marginTop:5}}><StatusBadge status={effectiveInstallmentStatus(i,todayKey)}/></div></div></button>)}
      {priorDebtOverdue.map(d=><button type="button" className="list-row" key={`prior-debt-${d.id}`} onClick={()=>openDay(d.due_date)} style={{width:"100%",textAlign:"left",cursor:"pointer",border:0}}><div className="person"><div className="avatar debt-avatar"><CalendarClock size={15}/></div><div><div className="person-name">{d.title}</div><div className="person-meta">Dívida · venceu em {format(new Date(d.due_date+"T12:00:00"),"dd/MM/yyyy")}</div></div></div><div style={{textAlign:"right"}}><strong className="money-negative">- {money(d.amount)}</strong><div style={{marginTop:5}}><span className="badge red">Atrasada</span></div></div></button>)}
    </div></div>}

    <div className="card calendar-shell-card">
      <div className="section-title"><div><div className="eyebrow">Visão mensal</div><h2 style={{textTransform:"capitalize"}}>{format(month,"MMMM 'de' yyyy",{locale:ptBR})}</h2><div className="muted" style={{fontSize:12}}>Clique em qualquer dia para ver entradas, dívidas e ações disponíveis.</div></div><div className="calendar-nav"><button className="btn secondary" onClick={()=>setMonth(new Date())}>Hoje</button><button className="icon-btn" onClick={()=>setMonth(subMonths(month,1))}><ChevronLeft size={17}/></button><button className="icon-btn" onClick={()=>setMonth(addMonths(month,1))}><ChevronRight size={17}/></button></div></div>
      <div className="calendar-grid">{["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(d=><div key={d} className="calendar-head">{d}</div>)}{days.map(day=>{const key=format(day,"yyyy-MM-dd");const rows=installments.filter(i=>i.due_date===key);const debtRows=debts.filter(d=>d.status!=="CANCELADO"&&d.due_date===key);const extra=Math.max(0,rows.length+debtRows.length-5);return <button type="button" key={key} className={`calendar-day ${key===todayKey?"today":""}`} onClick={()=>openDay(key)} style={{opacity:isSameMonth(day,month)?1:.35,cursor:"pointer",textAlign:"left",font:"inherit",color:"inherit"}}><div className="day-number">{format(day,"d")}</div>{rows.slice(0,3).map(i=>{const status=effectiveInstallmentStatus(i,todayKey);return <div className={`calendar-item ${status}`} key={i.id} title={`${i.client?.name} ${money(i.remaining_amount)}`}><span className="calendar-kind">+</span>{i.client?.name} · {money(i.remaining_amount)}</div>})}{debtRows.slice(0,2).map(d=><div className={`calendar-item DEBT ${d.status}`} key={`debt-${d.id}`} title={`${d.title} ${money(d.amount)}`}><span className="calendar-kind">−</span>{d.title} · {money(d.amount)}</div>)}{extra>0&&<div className="muted" style={{fontSize:10,marginTop:5}}>+{extra} movimentações</div>}</button>})}</div>

      <div className="mobile-financial-list">
        {[...monthRows.map(i=>({kind:"income" as const,date:i.due_date,id:i.id,title:i.client?.name||"Cliente",meta:`${i.loan?.loan_code} · parcela ${i.installment_number}/${i.loan?.installment_count}`,amount:Number(i.remaining_amount),status:effectiveInstallmentStatus(i,todayKey)})),...monthDebts.map(d=>({kind:"debt" as const,date:d.due_date,id:d.id,title:d.title,meta:d.notes||"Dívida a pagar",amount:Number(d.amount),status:d.status==="PAGO"?"PAGO":d.status==="PENDENTE"&&d.due_date<todayKey?"ATRASADO":"PENDENTE"}))].sort((a,b)=>a.date.localeCompare(b.date)).map(row=><button type="button" className="list-row financial-mobile-row" key={`${row.kind}-${row.id}`} onClick={()=>openDay(row.date)}><div className="person"><div className={`avatar ${row.kind==="debt"?"debt-avatar":""}`}>{row.kind==="debt"?<CalendarClock size={15}/>:row.title[0]}</div><div><div className="person-name">{row.title}</div><div className="person-meta">{format(new Date(row.date+"T12:00:00"),"dd/MM/yyyy")} · {row.meta}</div></div></div><div className="financial-row-value"><strong className={row.kind==="debt"?"money-negative":"money-positive"}>{row.kind==="debt"?"- ":"+ "}{money(row.amount)}</strong><StatusBadge status={row.status}/></div></button>)}
      </div>
    </div>

    {selectedDate&&<div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setSelectedDate(null)}}><div className="modal financial-day-modal" style={{maxWidth:860}}>
      <div className="section-title"><div><div className="eyebrow">Resumo financeiro do dia</div><h2 style={{textTransform:"capitalize"}}>{format(new Date(selectedDate+"T12:00:00"),"dd 'de' MMMM 'de' yyyy",{locale:ptBR})}</h2><div className="muted" style={{fontSize:12}}>{selectedRows.length} recebimento{selectedRows.length===1?"":"s"} · {selectedDebts.length} dívida{selectedDebts.length===1?"":"s"}.</div></div><button className="icon-btn" onClick={()=>setSelectedDate(null)}><X size={17}/></button></div>
      <div className="kpi-strip" style={{marginTop:14}}><div className="kpi-mini"><span className="muted">A receber</span><strong>{money(selectedTotals.saldo)}</strong></div><div className="kpi-mini"><span className="muted">Recebido</span><strong className="money-positive">{money(selectedTotals.recebido)}</strong></div><div className="kpi-mini"><span className="muted">Dívidas</span><strong className="money-negative">{money(selectedTotals.dividas)}</strong></div><div className="kpi-mini featured"><span className="muted">Líquido previsto</span><strong>{money(selectedTotals.saldo-selectedTotals.dividas)}</strong></div></div>
      {error&&<div className="alert alert-error" style={{marginTop:14}}>{error}</div>}{message&&<div className="alert alert-success" style={{marginTop:14}}>{message}</div>}
      {selectedRows.length===0&&selectedDebts.length===0&&<div className="card" style={{marginTop:14,textAlign:"center"}}><strong>Nenhuma movimentação neste dia.</strong><div className="muted" style={{fontSize:12,marginTop:5}}>Escolha outro dia no calendário.</div></div>}

      {selectedDebts.length>0&&<div style={{marginTop:14}}><div className="subsection-label">Dívidas a pagar</div><div className="list">{selectedDebts.map(d=>{const overdue=d.status==="PENDENTE"&&d.due_date<todayKey;return <div className="card debt-calendar-card" key={`manage-debt-${d.id}`}><div className="section-title"><div className="person"><div className="avatar debt-avatar"><CalendarClock size={16}/></div><div><div className="person-name">{d.title}</div><div className="person-meta">{d.notes||"Compromisso do Meu Caixa"}</div></div></div><span className={`badge ${d.status==="PAGO"?"green":overdue?"red":"yellow"}`}>{d.status==="PAGO"?"Pago":overdue?"Atrasada":"Pendente"}</span></div><div className="debt-calendar-main"><div><span className="muted">Valor</span><strong className="money-negative">{money(d.amount)}</strong></div>{d.payment_date&&<div><span className="muted">Pago em</span><strong>{format(new Date(d.payment_date+"T12:00:00"),"dd/MM/yyyy")}</strong></div>}</div>{d.status==="PENDENTE"&&<form action={(fd)=>payDebt(d.id,fd)} className="debt-pay-form calendar-debt-pay"><input className="input" type="date" name="payment_date" defaultValue={todayKey} required/><button className="btn" disabled={pending}><CheckCircle2 size={15}/>Marcar pago</button></form>}{d.status==="PAGO"&&<div style={{display:"flex",justifyContent:"flex-end",marginTop:12}}><button className="btn secondary" type="button" disabled={pending} onClick={()=>undoDebt(d.id)}><RotateCcw size={15}/>Desfazer pagamento</button></div>}</div>})}</div></div>}

      {selectedRows.length>0&&<div style={{marginTop:14}}><div className="subsection-label">Recebimentos de clientes</div><div className="list">{selectedRows.map(i=>{const status=effectiveInstallmentStatus(i,todayKey);const hasPaid=Number(i.amount_paid)>0;const remaining=Number(i.remaining_amount);return <div className="card" key={`manage-${i.id}`} style={{padding:14}}>
        <div className="section-title"><div className="person"><div className="avatar">{i.client?.name?.[0]||"?"}</div><div><div className="person-name">{i.client?.name}</div><div className="person-meta">{i.loan?.loan_code} · parcela {i.installment_number}/{i.loan?.installment_count}</div></div></div><StatusBadge status={status}/></div>
        <div className="grid-equal installment-financial-grid" style={{marginTop:12}}><div><div className="muted" style={{fontSize:11}}>Valor da parcela</div><strong>{money(i.amount)}</strong></div><div><div className="muted" style={{fontSize:11}}>Já recebido</div><strong className="money-positive">{money(i.amount_paid)}</strong></div><div><div className="muted" style={{fontSize:11}}>Saldo</div><strong>{money(i.remaining_amount)}</strong></div></div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}><WhatsAppButton phone={i.client?.whatsapp||i.client?.phone} message={chargeMessage(i)}/><RenegotiateInstallment installment={i}/></div>
        {remaining>0&&<form key={`payment-${i.id}-${i.remaining_amount}`} action={submitPayment} className="form-grid" style={{marginTop:14}}><input type="hidden" name="installment_id" value={i.id}/><div className="field"><label>Valor recebido</label><input className="input" name="amount" type="number" min="0.01" max={remaining} step="0.01" defaultValue={remaining.toFixed(2)} required/></div><div className="field"><label>Data do pagamento</label><input className="input" name="payment_date" type="date" defaultValue={todayKey} required/></div><div className="field"><label>Forma de pagamento</label><select className="select" name="payment_method" defaultValue="PIX"><option value="PIX">PIX</option><option value="DINHEIRO">Dinheiro</option><option value="TRANSFERENCIA">Transferência</option><option value="OUTRO">Outro</option></select></div><div className="field"><label>Observação</label><input className="input" name="notes" placeholder="Opcional"/></div><div className="field full"><div className="muted" style={{fontSize:11}}>Para marcar como pago, deixe o valor igual ao saldo. Para parcial, informe um valor menor.</div></div><div className="field full" style={{alignItems:"flex-end"}}><button className="btn" disabled={pending}><CreditCard size={16}/>{pending?"Salvando...":"Registrar pagamento"}</button></div></form>}
        {hasPaid&&<div style={{display:"flex",justifyContent:"flex-end",marginTop:12}}><button type="button" className="btn secondary" disabled={pending} onClick={()=>undoPayment(i.id)}><Undo2 size={16}/> Marcar como não pago</button></div>}
      </div>})}</div></div>}
    </div></div>}
  </>;
}

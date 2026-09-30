"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CreditCard, Undo2, X } from "lucide-react";
import { effectiveInstallmentStatus, money } from "@/lib/finance";
import { brazilDateKey } from "@/lib/date";
import { StatusBadge } from "@/components/ui/status-badge";
import { registerPaymentSafeAction, markInstallmentUnpaidSafeAction } from "@/app/operations-actions";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";
import { RenegotiateInstallment } from "@/components/forms/renegotiate-installment";
import type { Installment } from "@/lib/types";

export function CalendarBoard({ installments }: { installments: Installment[] }) {
  const router = useRouter();
  const [month,setMonth]=useState(new Date());
  const [selectedDate,setSelectedDate]=useState<string|null>(null);
  const [pending,startTransition]=useTransition();
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const todayKey=brazilDateKey();

  const days=useMemo(()=>eachDayOfInterval({
    start:startOfWeek(startOfMonth(month),{weekStartsOn:0}),
    end:endOfWeek(endOfMonth(month),{weekStartsOn:0}),
  }),[month]);

  const monthKey=format(month,"yyyy-MM");
  const monthStartKey=format(startOfMonth(month),"yyyy-MM-dd");
  const monthRows=installments.filter(i=>i.due_date.startsWith(monthKey));
  const priorOverdue=installments
    .filter(i=>i.due_date<monthStartKey&&effectiveInstallmentStatus(i,todayKey)==="ATRASADO")
    .sort((a,b)=>a.due_date.localeCompare(b.due_date));
  const selectedRows=selectedDate
    ? installments.filter(i=>i.due_date===selectedDate).sort((a,b)=>a.installment_number-b.installment_number)
    : [];

  const selectedTotals={
    previsto:selectedRows.reduce((s,i)=>s+Number(i.amount),0),
    recebido:selectedRows.reduce((s,i)=>s+Number(i.amount_paid),0),
    saldo:selectedRows.reduce((s,i)=>s+Number(i.remaining_amount),0),
  };

  const totals={
    previsto:monthRows.reduce((s,i)=>s+Number(i.amount),0),
    recebido:monthRows.reduce((s,i)=>s+Number(i.amount_paid),0),
    pendente:monthRows.reduce((s,i)=>s+Number(i.remaining_amount),0),
    atrasado:monthRows
      .filter(i=>effectiveInstallmentStatus(i,todayKey)==="ATRASADO")
      .reduce((s,i)=>s+Number(i.remaining_amount),0)
      + priorOverdue.reduce((s,i)=>s+Number(i.remaining_amount),0),
  };

  function openDay(date:string){setError("");setMessage("");setSelectedDate(date)}

  async function submitPayment(formData:FormData){
    setError("");
    setMessage("");
    startTransition(async()=>{
      const result=await registerPaymentSafeAction(formData);
      if(!result.ok){setError(result.error);return;}
      setMessage(result.message||"Pagamento registrado.");
      router.refresh();
    });
  }

  function undoPayment(installmentId:string){
    if(!window.confirm("Marcar esta parcela como não paga? Os pagamentos serão estornados, mas continuarão salvos no histórico."))return;
    setError("");
    setMessage("");
    const formData=new FormData();
    formData.set("installment_id",installmentId);
    startTransition(async()=>{
      const result=await markInstallmentUnpaidSafeAction(formData);
      if(!result.ok){setError(result.error);return;}
      setMessage(result.message||"Pagamento desfeito.");
      router.refresh();
    });
  }

  function chargeMessage(i:Installment){
    return `Olá, ${i.client?.name||""}! Sua parcela de ${money(i.remaining_amount)} do empréstimo ${i.loan?.loan_code||""} vence em ${i.due_date}. Se já pagou, desconsidere.`;
  }

  return <>
    <div className="kpi-strip financial-kpis">
      <div className="kpi-mini"><span className="muted">Previsto no mês</span><strong>{money(totals.previsto)}</strong></div>
      <div className="kpi-mini"><span className="muted">Recebido</span><strong className="money-positive">{money(totals.recebido)}</strong></div>
      <div className="kpi-mini featured"><span className="muted">Pendente</span><strong>{money(totals.pendente)}</strong></div>
      <div className="kpi-mini"><span className="muted">Atrasado</span><strong className="money-negative">{money(totals.atrasado)}</strong></div>
    </div>

    <div className="card calendar-legend">
      <div className="financial-legend">
        <strong>Legenda</strong>
        <span><i className="legend-dot income"/> Recebimento</span>
        <span className="badge green">Pago</span>
        <span className="badge yellow">Pendente</span>
        <span className="badge red">Atrasado</span>
      </div>
    </div>

    {priorOverdue.length>0&&<div className="card attention-card" style={{marginBottom:16}}>
      <div className="section-title">
        <div><h2>Pendências de meses anteriores</h2><div className="muted" style={{fontSize:12}}>Parcelas que continuam com saldo em aberto.</div></div>
        <span className="badge red">{priorOverdue.length}</span>
      </div>
      <div className="list">
        {priorOverdue.map(i=><button type="button" className="list-row" key={`prior-${i.id}`} onClick={()=>openDay(i.due_date)} style={{width:"100%",textAlign:"left",cursor:"pointer",border:0}}>
          <div className="person"><div className="avatar">{i.client?.name?.[0]||"?"}</div><div><div className="person-name">{i.client?.name}</div><div className="person-meta">Venceu em {format(new Date(i.due_date+"T12:00:00"),"dd/MM/yyyy")} · {i.loan?.loan_code}</div></div></div>
          <div style={{textAlign:"right"}}><strong className="money-positive">+ {money(i.remaining_amount)}</strong><div style={{marginTop:5}}><StatusBadge status={effectiveInstallmentStatus(i,todayKey)}/></div></div>
        </button>)}
      </div>
    </div>}

    <div className="card calendar-shell-card">
      <div className="section-title">
        <div>
          <div className="eyebrow">Visão mensal</div>
          <h2 style={{textTransform:"capitalize"}}>{format(month,"MMMM 'de' yyyy",{locale:ptBR})}</h2>
          <div className="muted" style={{fontSize:12}}>Clique em qualquer dia para ver os recebimentos e ações disponíveis.</div>
        </div>
        <div className="calendar-nav">
          <button className="btn secondary" onClick={()=>setMonth(new Date())}>Hoje</button>
          <button className="icon-btn" onClick={()=>setMonth(subMonths(month,1))}><ChevronLeft size={17}/></button>
          <button className="icon-btn" onClick={()=>setMonth(addMonths(month,1))}><ChevronRight size={17}/></button>
        </div>
      </div>

      <div className="calendar-grid">
        {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(d=><div key={d} className="calendar-head">{d}</div>)}
        {days.map(day=>{
          const key=format(day,"yyyy-MM-dd");
          const rows=installments.filter(i=>i.due_date===key);
          const extra=Math.max(0,rows.length-5);
          return <button type="button" key={key} className={`calendar-day ${key===todayKey?"today":""}`} onClick={()=>openDay(key)} style={{opacity:isSameMonth(day,month)?1:.35,cursor:"pointer",textAlign:"left",font:"inherit",color:"inherit"}}>
            <div className="day-number">{format(day,"d")}</div>
            {rows.slice(0,5).map(i=>{
              const status=effectiveInstallmentStatus(i,todayKey);
              const displayValue=status==="PAGO"?Number(i.amount_paid):Number(i.remaining_amount);
              return <div className={`calendar-item ${status}`} key={i.id} title={`${i.client?.name} ${money(displayValue)}`}>
                <span className="calendar-kind">+</span>{i.client?.name} · {money(displayValue)}
              </div>;
            })}
            {extra>0&&<div className="muted" style={{fontSize:10,marginTop:5}}>+{extra} recebimentos</div>}
          </button>;
        })}
      </div>

      <div className="mobile-financial-list">
        {monthRows.map(i=>({
          date:i.due_date,
          id:i.id,
          title:i.client?.name||"Cliente",
          meta:`${i.loan?.loan_code} · parcela ${i.installment_number}/${i.loan?.installment_count}`,
          amount:effectiveInstallmentStatus(i,todayKey)==="PAGO"?Number(i.amount_paid):Number(i.remaining_amount),
          status:effectiveInstallmentStatus(i,todayKey),
        })).sort((a,b)=>a.date.localeCompare(b.date)).map(row=><button type="button" className="list-row financial-mobile-row" key={row.id} onClick={()=>openDay(row.date)}>
          <div className="person"><div className="avatar">{row.title[0]}</div><div><div className="person-name">{row.title}</div><div className="person-meta">{format(new Date(row.date+"T12:00:00"),"dd/MM/yyyy")} · {row.meta}</div></div></div>
          <div className="financial-row-value"><strong className="money-positive">+ {money(row.amount)}</strong><StatusBadge status={row.status}/></div>
        </button>)}
      </div>
    </div>

    {selectedDate&&<div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setSelectedDate(null)}}>
      <div className="modal financial-day-modal" style={{maxWidth:860}}>
        <div className="section-title">
          <div><div className="eyebrow">Resumo do dia</div><h2 style={{textTransform:"capitalize"}}>{format(new Date(selectedDate+"T12:00:00"),"dd 'de' MMMM 'de' yyyy",{locale:ptBR})}</h2><div className="muted" style={{fontSize:12}}>{selectedRows.length} recebimento{selectedRows.length===1?"":"s"}.</div></div>
          <button className="icon-btn" onClick={()=>setSelectedDate(null)}><X size={17}/></button>
        </div>

        <div className="kpi-strip" style={{marginTop:14}}>
          <div className="kpi-mini"><span className="muted">Previsto</span><strong>{money(selectedTotals.previsto)}</strong></div>
          <div className="kpi-mini"><span className="muted">Recebido</span><strong className="money-positive">{money(selectedTotals.recebido)}</strong></div>
          <div className="kpi-mini featured"><span className="muted">Saldo</span><strong>{money(selectedTotals.saldo)}</strong></div>
        </div>

        {error&&<div className="alert alert-error" style={{marginTop:14}}>{error}</div>}
        {message&&<div className="alert alert-success" style={{marginTop:14}}>{message}</div>}
        {selectedRows.length===0&&<div className="card" style={{marginTop:14,textAlign:"center"}}><strong>Nenhum recebimento neste dia.</strong><div className="muted" style={{fontSize:12,marginTop:5}}>Escolha outro dia no calendário.</div></div>}

        {selectedRows.length>0&&<div style={{marginTop:14}}>
          <div className="subsection-label">Recebimentos de clientes</div>
          <div className="list">
            {selectedRows.map(i=>{
              const status=effectiveInstallmentStatus(i,todayKey);
              const hasPaid=Number(i.amount_paid)>0;
              const remaining=Number(i.remaining_amount);
              const canRenegotiate=i.loan?.status==="ATIVO"&&remaining>0;
              return <div className="card" key={`manage-${i.id}`} style={{padding:14}}>
                <div className="section-title">
                  <div className="person"><div className="avatar">{i.client?.name?.[0]||"?"}</div><div><div className="person-name">{i.client?.name}</div><div className="person-meta">{i.loan?.loan_code} · parcela {i.installment_number}/{i.loan?.installment_count}</div></div></div>
                  <StatusBadge status={status}/>
                </div>
                <div className="grid-equal installment-financial-grid" style={{marginTop:12}}>
                  <div><div className="muted" style={{fontSize:11}}>Valor da parcela</div><strong>{money(i.amount)}</strong></div>
                  <div><div className="muted" style={{fontSize:11}}>Já recebido</div><strong className="money-positive">{money(i.amount_paid)}</strong></div>
                  <div><div className="muted" style={{fontSize:11}}>Saldo</div><strong>{money(i.remaining_amount)}</strong></div>
                </div>
                {remaining>0&&<div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:12}}>
                  <WhatsAppButton phone={i.client?.whatsapp||i.client?.phone} message={chargeMessage(i)}/>
                  {canRenegotiate?<RenegotiateInstallment installment={i}/>:null}
                </div>}
                {remaining>0&&<form key={`payment-${i.id}-${i.remaining_amount}`} action={submitPayment} className="form-grid" style={{marginTop:14}}>
                  <input type="hidden" name="installment_id" value={i.id}/>
                  <div className="field"><label>Valor recebido</label><input className="input" name="amount" type="number" min="0.01" max={remaining} step="0.01" defaultValue={remaining.toFixed(2)} required/></div>
                  <div className="field"><label>Data do pagamento</label><input className="input" name="payment_date" type="date" defaultValue={todayKey} required/></div>
                  <div className="field"><label>Forma de pagamento</label><select className="select" name="payment_method" defaultValue="PIX"><option value="PIX">PIX</option><option value="DINHEIRO">Dinheiro</option><option value="TRANSFERENCIA">Transferência</option><option value="OUTRO">Outro</option></select></div>
                  <div className="field"><label>Observação</label><input className="input" name="notes" placeholder="Opcional"/></div>
                  <div className="field full"><div className="muted" style={{fontSize:11}}>Para marcar como pago, deixe o valor igual ao saldo. Para parcial, informe um valor menor.</div></div>
                  <div className="field full" style={{alignItems:"flex-end"}}><button className="btn" disabled={pending}><CreditCard size={16}/>{pending?"Salvando...":"Registrar pagamento"}</button></div>
                </form>}
                {hasPaid&&<div style={{display:"flex",justifyContent:"flex-end",marginTop:12}}><button type="button" className="btn secondary" disabled={pending} onClick={()=>undoPayment(i.id)}><Undo2 size={16}/> Marcar como não pago</button></div>}
              </div>;
            })}
          </div>
        </div>}
      </div>
    </div>}
  </>;
}

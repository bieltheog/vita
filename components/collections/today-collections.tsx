"use client";

import { EmptyState } from "@/components/ui/empty-state";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Search, Undo2, Rows3, SlidersHorizontal, X } from "lucide-react";
import { registerPaymentSafeAction, markInstallmentUnpaidSafeAction } from "@/app/operations-actions";
import { effectiveInstallmentStatus, money } from "@/lib/finance";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";
import { RenegotiateInstallment } from "@/components/forms/renegotiate-installment";
import type { Installment } from "@/lib/types";

function normalize(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()}
function formatDate(value:string){
  const [year,month,day]=value.split("-");
  return `${day}/${month}/${year}`;
}
function daysLate(due:string,today:string){
  const a=Date.parse(`${due}T00:00:00Z`),b=Date.parse(`${today}T00:00:00Z`);
  return Math.max(0,Math.round((b-a)/86400000));
}

type Filter="TODOS"|"ATRASADOS"|"PARCIAIS"|"HOJE";

function traits(row:Installment,dateKey:string){
  const remaining=Number(row.remaining_amount);
  const paid=Number(row.amount_paid)>0;
  const overdue=row.due_date<dateKey;
  const today=row.due_date===dateKey;
  return {remaining,paid,overdue,today};
}

function statusLabel(row:Installment,dateKey:string){
  const {paid,overdue}=traits(row,dateKey);
  if(overdue&&paid)return "Parcial atrasado";
  if(overdue)return "Atrasado";
  if(paid)return "Parcial";
  return "Vence hoje";
}

function statusClass(row:Installment,dateKey:string){
  const {paid,overdue}=traits(row,dateKey);
  if(overdue)return "red";
  if(paid)return "orange";
  return "blue";
}

export function TodayCollections({ items, dateKey, initialFilter="TODOS" }: { items: Installment[]; dateKey: string; initialFilter?: "TODOS"|"ATRASADOS" }) {
  const router=useRouter();
  const [query,setQuery]=useState("");
  const [filter,setFilter]=useState<Filter>(initialFilter);
  const [compact,setCompact]=useState(false);
  const [payRow,setPayRow]=useState<Installment|null>(null);
  const [payAmount,setPayAmount]=useState("");
  const [payMethod,setPayMethod]=useState("PIX");
  const [payDate,setPayDate]=useState(dateKey);
  const [pending,start]=useTransition();
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");

  const sorted=useMemo(()=>[...items].sort((a,b)=>{
    const ta=traits(a,dateKey),tb=traits(b,dateKey);
    const pa=ta.overdue?0:ta.paid?1:2;
    const pb=tb.overdue?0:tb.paid?1:2;
    if(pa!==pb)return pa-pb;
    if(a.due_date!==b.due_date)return a.due_date.localeCompare(b.due_date);
    return String(a.client?.name||"").localeCompare(String(b.client?.name||""),"pt-BR");
  }),[items,dateKey]);

  const filtered=useMemo(()=>sorted.filter(row=>{
    const search=normalize(`${row.client?.name||""} ${row.loan?.loan_code||""}`);
    if(query&&!search.includes(normalize(query)))return false;
    const t=traits(row,dateKey);
    if(filter==="ATRASADOS")return t.overdue;
    if(filter==="PARCIAIS")return t.paid&&t.remaining>0;
    if(filter==="HOJE")return t.today;
    return true;
  }),[sorted,query,filter,dateKey]);

  const groups=useMemo(()=>{
    const map=new Map<string,{key:string;name:string;phone?:string|null;items:Installment[];total:number;oldest:string;hasOverdue:boolean;hasPartial:boolean;hasToday:boolean}>();
    filtered.forEach(row=>{
      const key=row.client_id||row.client?.name||row.id;
      const current=map.get(key)||{
        key,
        name:row.client?.name||"Cliente",
        phone:row.client?.whatsapp||row.client?.phone,
        items:[],total:0,oldest:row.due_date,hasOverdue:false,hasPartial:false,hasToday:false,
      };
      const t=traits(row,dateKey);
      current.items.push(row);
      current.total+=t.remaining;
      if(row.due_date<current.oldest)current.oldest=row.due_date;
      current.hasOverdue ||= t.overdue;
      current.hasPartial ||= t.paid;
      current.hasToday ||= t.today;
      map.set(key,current);
    });
    return [...map.values()].sort((a,b)=>{
      const pa=a.hasOverdue?0:a.hasPartial?1:2;
      const pb=b.hasOverdue?0:b.hasPartial?1:2;
      if(pa!==pb)return pa-pb;
      return b.total-a.total;
    });
  },[filtered,dateKey]);

  function openPay(row:Installment){
    setError("");setMessage("");
    setPayRow(row);
    setPayAmount(Number(row.remaining_amount).toFixed(2));
    setPayMethod("PIX");
    setPayDate(dateKey);
  }

  function confirmPay(){
    if(!payRow)return;
    const row=payRow;
    const amount=Number(payAmount.replace(",","."));
    setError("");setMessage("");
    const fd=new FormData();
    fd.set("installment_id",row.id);fd.set("amount",String(amount));fd.set("payment_date",payDate);fd.set("payment_method",payMethod);
    start(async()=>{
      const result=await registerPaymentSafeAction(fd);
      setPayRow(null);
      if(!result.ok){setError(result.error);return;}
      const partial=amount<Number(row.remaining_amount)-0.005;
      setMessage(`${partial?"Pagamento parcial":"Pagamento"} de ${money(amount)} registrado para ${row.client?.name||"o cliente"}.`);router.refresh();
    });
  }

  async function undo(row:Installment){
    if(!window.confirm("Desfazer os pagamentos desta parcela? O histórico será preservado."))return;
    setError("");setMessage("");
    const fd=new FormData();fd.set("installment_id",row.id);
    start(async()=>{
      const result=await markInstallmentUnpaidSafeAction(fd);
      if(!result.ok){setError(result.error);return;}
      setMessage(result.message||"Pagamento desfeito.");router.refresh();
    });
  }

  function messageFor(row:Installment){
    const t=traits(row,dateKey);
    const situation=t.overdue?`está em atraso desde ${formatDate(row.due_date)}`:t.paid?"está parcialmente paga":"vence hoje";
    return `Olá, ${row.client?.name||""}! Sua parcela ${situation}. O saldo pendente é de ${money(row.remaining_amount)} (${row.loan?.loan_code||"empréstimo"}). Se já realizou o pagamento, desconsidere esta mensagem.`;
  }

  function Row({row}:{row:Installment}){
    const t=traits(row,dateKey);
    const lateDays=t.overdue?daysLate(row.due_date,dateKey):0;
    return <div className={`collection-card ${t.overdue?"is-late":t.paid?"is-partial":"is-today"}`}>
      <div className="collection-card-main">
        <div className="collection-person">
          <div className="avatar collection-avatar">{row.client?.name?.[0]||"?"}</div>
          <div className="collection-person-copy">
            <div className="collection-name">{row.client?.name||"Cliente"}</div>
            <div className="collection-meta">{row.loan?.loan_code} · {row.installment_number}/{row.loan?.installment_count} · {formatDate(row.due_date)}{lateDays?` · ${lateDays}d atraso`:""}</div>
          </div>
        </div>
        <div className="collection-money-block">
          <span className={`badge ${statusClass(row,dateKey)}`}>{statusLabel(row,dateKey)}</span>
          <strong className="collection-debt">{money(t.remaining)}</strong>
          {t.paid&&<span className="collection-paid">já pago {money(row.amount_paid)}</span>}
        </div>
      </div>
      <div className="collection-actions">
        <WhatsAppButton compact phone={row.client?.whatsapp||row.client?.phone} message={messageFor(row)}/>
        {t.remaining>0&&<button type="button" className="btn collection-pay-btn" disabled={pending} onClick={()=>openPay(row)} title="Registrar recebimento"><CreditCard size={15}/>Receber</button>}
        <RenegotiateInstallment installment={row} compact/>
        {t.paid&&<button type="button" className="icon-btn" disabled={pending} onClick={()=>undo(row)} title="Desfazer pagamento"><Undo2 size={15}/></button>}
      </div>
    </div>;
  }

  const total=items.reduce((s,r)=>s+Number(r.remaining_amount),0);
  const overdueItems=items.filter(r=>traits(r,dateKey).overdue);
  const partialItems=items.filter(r=>traits(r,dateKey).paid&&traits(r,dateKey).remaining>0);
  const todayItems=items.filter(r=>traits(r,dateKey).today);
  const overdueTotal=overdueItems.reduce((s,r)=>s+Number(r.remaining_amount),0);
  const partialTotal=partialItems.reduce((s,r)=>s+Number(r.remaining_amount),0);
  const todayTotal=todayItems.reduce((s,r)=>s+Number(r.remaining_amount),0);
  const people=new Set(items.map(r=>r.client_id||r.client?.name||r.id)).size;

  return <>
    <div className="collections-summary">
      <div className="collection-kpi primary"><span>Total para cobrar</span><strong>{money(total)}</strong><small>{people} pessoa{people===1?"":"s"}</small></div>
      <div className="collection-kpi danger"><span>Atrasado</span><strong>{money(overdueTotal)}</strong><small>{overdueItems.length} cobrança{overdueItems.length===1?"":"s"}</small></div>
      <div className="collection-kpi warning"><span>Parcial</span><strong>{money(partialTotal)}</strong><small>{partialItems.length} parcial{partialItems.length===1?"":"is"}</small></div>
      <div className="collection-kpi info"><span>Hoje</span><strong>{money(todayTotal)}</strong><small>{todayItems.length} vencimento{todayItems.length===1?"":"s"}</small></div>
    </div>

    <div className="collections-toolbar">
      <div className="search-box collections-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar nome ou empréstimo..."/></div>
      <div className="collection-filter-scroll">
        {([
          ["TODOS","Todos",items.length],
          ["ATRASADOS","Atrasados",overdueItems.length],
          ["PARCIAIS","Parciais",partialItems.length],
          ["HOJE","Hoje",todayItems.length],
        ] as [Filter,string,number][]).map(([value,label,count])=><button key={value} type="button" className={`collection-filter ${filter===value?"active":""}`} onClick={()=>setFilter(value)}>{label}<span>{count}</span></button>)}
      </div>
      <button type="button" className={`btn secondary collections-mode ${compact?"active":""}`} onClick={()=>setCompact(v=>!v)} title={compact?"Mostrar ações de cobrança":"Compactar para prints"}>
        {compact?<SlidersHorizontal size={16}/>:<Rows3 size={16}/>} {compact?"Mostrar ações":"Modo compacto"}
      </button>
    </div>

    {error&&<div className="alert alert-error alert-gap-bottom">{error}</div>}
    {message&&<div className="alert alert-success alert-gap-bottom">{message}</div>}

    {payRow&&(()=>{
      const remaining=Number(payRow.remaining_amount);
      const amount=Number(payAmount.replace(",","."));
      const invalid=!(amount>0)||amount>remaining+0.005||!payDate;
      const partial=amount>0&&amount<remaining-0.005;
      return <div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target&&!pending)setPayRow(null)}}><div className="modal pay-confirm">
        <div className="section-title"><div><h2>Receber de {payRow.client?.name||"cliente"}</h2><div className="muted text-sm">{payRow.loan?.loan_code} · parcela {payRow.installment_number}/{payRow.loan?.installment_count} · saldo {money(remaining)}</div></div><button type="button" className="icon-btn" title="Fechar" onClick={()=>setPayRow(null)} disabled={pending}><X size={17}/></button></div>
        <div className="form-grid form-gap">
          <div className="field full"><label htmlFor="pay-amount">Valor recebido</label><input id="pay-amount" className="input pay-amount" type="number" inputMode="decimal" min="0.01" step="0.01" max={remaining} value={payAmount} onChange={e=>setPayAmount(e.target.value)} autoFocus/>
            <div className="pay-hint">{amount>remaining+0.005?<span className="money-negative">O valor passa do saldo da parcela.</span>:partial?<span className="text-orange">Pagamento parcial · ficam {money(remaining-amount)} em aberto</span>:<span className="muted">Quita a parcela</span>}{partial&&<button type="button" className="link-btn" onClick={()=>setPayAmount(remaining.toFixed(2))}>Usar valor total</button>}</div>
          </div>
          <div className="field"><label htmlFor="pay-method">Forma</label><select id="pay-method" className="select" value={payMethod} onChange={e=>setPayMethod(e.target.value)}><option value="PIX">PIX</option><option value="DINHEIRO">Dinheiro</option><option value="TRANSFERENCIA">Transferência</option><option value="OUTRO">Outro</option></select></div>
          <div className="field"><label htmlFor="pay-date">Data</label><input id="pay-date" className="input" type="date" value={payDate} max={dateKey} onChange={e=>setPayDate(e.target.value)}/></div>
          <div className="field full form-actions"><button type="button" className="btn secondary" onClick={()=>setPayRow(null)} disabled={pending}>Cancelar</button><button type="button" className="btn" onClick={confirmPay} disabled={pending||invalid}>{pending?"Registrando...":`Confirmar ${money(amount>0?amount:0)}`}</button></div>
        </div>
      </div></div>;
    })()}

    {compact?<>
      <div className="collections-print-note"><strong>Modo compacto:</strong> uma pessoa por cartão, somando todas as cobranças pendentes visíveis. Ideal para capturas de tela.</div>
      <div className="collection-print-grid">
        {groups.map(group=>{
          const label=group.hasOverdue?(group.hasPartial?"Atrasado + parcial":"Atrasado"):group.hasPartial?"Parcial":"Hoje";
          const badge=group.hasOverdue?"red":group.hasPartial?"orange":"blue";
          const late=group.hasOverdue?daysLate(group.oldest,dateKey):0;
          return <div className={`collection-print-card ${group.hasOverdue?"is-late":group.hasPartial?"is-partial":"is-today"}`} key={group.key}>
            <div className="collection-print-top"><strong>{group.name}</strong><span className={`badge ${badge}`}>{label}</span></div>
            <div className="collection-print-amount">{money(group.total)}</div>
            <div className="collection-print-meta">{group.items.length} cobrança{group.items.length===1?"":"s"} · {group.hasOverdue?`mais antiga ${formatDate(group.oldest)}${late?` · ${late}d`:""}`:`vence ${formatDate(group.oldest)}`}</div>
          </div>;
        })}
      </div>
      {groups.length&&(items.length?<div className="card empty">Nenhuma cobrança encontrada neste filtro.</div>:<div className="card"><EmptyState title="Nada para cobrar hoje" text="Não há parcelas vencendo hoje nem em atraso." action={{href:"/calendario",label:"Ver calendário"}}/></div>)}
    </>:<div className="collection-operational-grid">
      {filtered.map(row=><Row key={row.id} row={row}/>) }
      {filtered.length&&(items.length?<div className="card empty">Nenhuma cobrança encontrada neste filtro.</div>:<div className="card"><EmptyState title="Nada para cobrar hoje" text="Não há parcelas vencendo hoje nem em atraso." action={{href:"/calendario",label:"Ver calendário"}}/></div>)}
    </div>}
  </>;
}

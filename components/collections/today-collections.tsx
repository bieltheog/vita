"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Search, Undo2, Rows3, SlidersHorizontal } from "lucide-react";
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

export function TodayCollections({ items, dateKey }: { items: Installment[]; dateKey: string }) {
  const router=useRouter();
  const [query,setQuery]=useState("");
  const [filter,setFilter]=useState<Filter>("TODOS");
  const [compact,setCompact]=useState(true);
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

  async function pay(row:Installment,amount:number){
    setError("");setMessage("");
    const fd=new FormData();
    fd.set("installment_id",row.id);fd.set("amount",String(amount));fd.set("payment_date",dateKey);fd.set("payment_method","PIX");
    start(async()=>{
      const result=await registerPaymentSafeAction(fd);
      if(!result.ok){setError(result.error);return;}
      setMessage(result.message||"Pagamento registrado.");router.refresh();
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
        {t.remaining>0&&<button type="button" className="btn collection-pay-btn" disabled={pending} onClick={()=>pay(row,t.remaining)} title="Quitar saldo"><CreditCard size={15}/>Quitar</button>}
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

    {error&&<div className="alert" style={{marginBottom:12}}>{error}</div>}
    {message&&<div className="alert" style={{marginBottom:12}}>{message}</div>}

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
      {!groups.length&&<div className="card empty">Nenhuma cobrança encontrada neste filtro.</div>}
    </>:<div className="collection-operational-grid">
      {filtered.map(row=><Row key={row.id} row={row}/>) }
      {!filtered.length&&<div className="card empty">Nenhuma cobrança encontrada neste filtro.</div>}
    </div>}
  </>;
}

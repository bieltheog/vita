import Link from "next/link";
import { addDays, format, parseISO } from "date-fns";
import { Wallet, CircleDollarSign, TrendingUp, CheckCircle2, AlertTriangle, Users, CalendarDays, BadgeDollarSign } from "lucide-react";
import { getDashboardSummary,getInstallments,getPayments,getCurrentProfile,getLoans } from "@/lib/data";
import { money,effectiveInstallmentStatus,daysOverdue } from "@/lib/finance";
import { brazilDateKey } from "@/lib/date";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { PaymentForm } from "@/components/forms/payment-form";

export default async function Dashboard(){
  const [s,i,p,profile,loans]=await Promise.all([getDashboardSummary(),getInstallments(),getPayments(),getCurrentProfile(),getLoans()]);
  const today=brazilDateKey(),month=today.slice(0,7);
  const next=i.filter(x=>Number(x.remaining_amount)>0).sort((a,b)=>a.due_date.localeCompare(b.due_date)).slice(0,6);
  const overdueRows=i.filter(x=>x.stored_status!=="CANCELADO"&&Number(x.remaining_amount)>0&&x.due_date<today);
  const late=overdueRows.slice(0,4);
  const todayRows=i.filter(x=>x.due_date===today);
  const pendingTodayRows=todayRows.filter(x=>Number(x.remaining_amount)>0);
  const completeToday=todayRows.filter(x=>Number(x.remaining_amount)<=0).length;
  const receivedMonth=p.filter(x=>x.payment_date.startsWith(month)).reduce((sum,x)=>sum+Number(x.amount),0);
  const loanMap=new Map(loans.map(l=>[l.id,l]));
  const realizedProfit=p.reduce((sum,payment)=>{const loan=loanMap.get(payment.loan_id);if(!loan||Number(loan.total_receivable)<=0)return sum;return sum+Number(payment.amount)*(Number(loan.expected_profit)/Number(loan.total_receivable));},0);
  const monthProfit=i.filter(x=>x.due_date.startsWith(month)).reduce((sum,row)=>{const loan=loanMap.get(row.loan_id);if(!loan||Number(loan.total_receivable)<=0)return sum;return sum+Number(row.amount)*(Number(loan.expected_profit)/Number(loan.total_receivable));},0);
  const delinquencyAmount=overdueRows.reduce((sum,row)=>sum+Number(row.remaining_amount),0);
  const delinquencyRate=s.totalReceivable>0?(delinquencyAmount/s.totalReceivable)*100:0;
  const delinquencyLabel=delinquencyRate.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})+"%";
  const delinquencyColor=delinquencyRate>25?"var(--red)":delinquencyRate>=15?"var(--orange)":"var(--green)";
  const bucketDefinitions=[
    {label:"1–7 dias",min:1,max:7},
    {label:"8–15 dias",min:8,max:15},
    {label:"16–30 dias",min:16,max:30},
    {label:"31–60 dias",min:31,max:60},
    {label:"+60 dias",min:61,max:Number.POSITIVE_INFINITY},
  ];
  const delinquencyBuckets=bucketDefinitions.map(bucket=>{
    const rows=overdueRows.filter(row=>{const days=daysOverdue(row.due_date,Number(row.remaining_amount));return days>=bucket.min&&days<=bucket.max;});
    return {...bucket,count:rows.length,amount:rows.reduce((sum,row)=>sum+Number(row.remaining_amount),0)};
  });

  const weekEnd=format(addDays(parseISO(today),6),"yyyy-MM-dd");
  const weekRows=i.filter(row=>row.stored_status!=="CANCELADO"&&row.due_date>=today&&row.due_date<=weekEnd);
  const weekExpected=weekRows.reduce((sum,row)=>sum+Number(row.amount),0);
  const weekReceived=weekRows.reduce((sum,row)=>sum+Number(row.amount_paid),0);
  const weekPending=weekRows.reduce((sum,row)=>sum+Number(row.remaining_amount),0);
  const weekOpenCount=weekRows.filter(row=>Number(row.remaining_amount)>0).length;
  const weekDays=Array.from({length:7},(_,index)=>{
    const date=format(addDays(parseISO(today),index),"yyyy-MM-dd");
    const rows=weekRows.filter(row=>row.due_date===date);
    return {
      date,
      label:index===0?"Hoje":format(parseISO(date),"dd/MM"),
      expected:rows.reduce((sum,row)=>sum+Number(row.amount),0),
      received:rows.reduce((sum,row)=>sum+Number(row.amount_paid),0),
      pending:rows.reduce((sum,row)=>sum+Number(row.remaining_amount),0),
      count:rows.filter(row=>Number(row.remaining_amount)>0).length,
    };
  });

  return <>
    <div className="page-head">
      <div><div className="eyebrow">Jureminha 2.0</div><h1>Olá, {profile?.full_name} 👋</h1><div className="muted">Resumo da carteira e atalhos para a rotina de cobrança.</div></div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><Link className="btn" href="/cobrancas-hoje"><CircleDollarSign size={16}/> Cobranças</Link><PaymentForm installments={i} demo={profile?.demo}/></div>
    </div>

    <div className="stats">
      <StatCard label="Capital em circulação" value={money(s.capitalCirculation)} meta="Principal atualmente emprestado" icon={Wallet} href="/emprestimos"/>
      <StatCard label="Total a receber" value={money(s.totalReceivable)} meta="Saldo pendente total" icon={CircleDollarSign} href="/pagamentos"/>
      <StatCard label="Lucro contratado" value={money(s.expectedProfit)} icon={TrendingUp} href="/relatorios"/>
      <StatCard label="Lucro realizado estimado" value={money(realizedProfit)} icon={BadgeDollarSign} href="/relatorios"/>
      <StatCard label="Atrasado" value={money(s.overdue)} icon={AlertTriangle} href="/cobrancas-hoje"/>
      <details className="card card-click" style={{cursor:"pointer"}}>
        <summary style={{listStyle:"none"}}>
          <div className="stat-label"><span>Inadimplência</span><span className="stat-icon"><AlertTriangle size={17}/></span></div>
          <div className="stat-value" style={{color:delinquencyColor}}>{delinquencyLabel}</div>
          <div className="stat-meta">{money(delinquencyAmount)} vencidos · toque para detalhar</div>
        </summary>
        <div style={{marginTop:14,paddingTop:12,borderTop:"1px solid var(--border)"}}>
          {delinquencyBuckets.map(bucket=><div className="list-row" key={bucket.label} style={{padding:"8px 0"}}><div><strong>{bucket.label}</strong><div className="person-meta">{bucket.count} parcela{bucket.count===1?"":"s"}</div></div><strong>{money(bucket.amount)}</strong></div>)}
          <div className="person-meta" style={{marginTop:8}}>Percentual calculado sobre o saldo total ainda a receber dos empréstimos ativos.</div>
        </div>
      </details>
      <StatCard label="Recebido no mês" value={money(receivedMonth)} icon={CalendarDays} href="/relatorios"/>
      <StatCard label="Lucro previsto no mês" value={money(monthProfit)} icon={TrendingUp} href="/relatorios"/>
      <StatCard label="Clientes ativos" value={String(s.activeClients)} icon={Users} href="/clientes"/>
    </div>

    <div className="card" style={{marginTop:16}}>
      <div className="section-title">
        <div><h2>Recebimentos — próximos 7 dias</h2><div className="person-meta">De {format(parseISO(today),"dd/MM")} até {format(parseISO(weekEnd),"dd/MM")} · somente empréstimos ativos</div></div>
        <Link href="/calendario" className="muted">Abrir calendário</Link>
      </div>
      <div className="grid-equal" style={{marginTop:10}}>
        <div className="list-row"><span>Previsto</span><strong>{money(weekExpected)}</strong></div>
        <div className="list-row"><span>Já recebido</span><strong style={{color:"var(--green)"}}>{money(weekReceived)}</strong></div>
        <div className="list-row"><span>Pendente</span><strong style={{color:weekPending>0?"var(--orange)":undefined}}>{money(weekPending)}</strong></div>
        <div className="list-row"><span>Cobranças pendentes</span><strong>{weekOpenCount}</strong></div>
      </div>
      <div className="list" style={{marginTop:10}}>
        {weekDays.map(day=><div className="list-row" key={day.date}><div><div className="person-name">{day.label}</div><div className="person-meta">{day.count} cobrança{day.count===1?"":"s"} pendente{day.count===1?"":"s"} · previsto {money(day.expected)}</div></div><div style={{textAlign:"right"}}><strong style={{color:day.pending>0?"var(--orange)":undefined}}>{money(day.pending)}</strong>{day.received>0&&<div className="person-meta">{money(day.received)} recebido</div>}</div></div>)}
      </div>
    </div>

    <div className="card" style={{marginTop:16}}>
      <div className="section-title">
        <div><h2>Fechamento de hoje</h2><div className="person-meta">{completeToday}/{todayRows.length} cobranças do dia quitadas</div></div>
        <Link href="/cobrancas-hoje" className="muted">Abrir cobranças</Link>
      </div>
      <div className="grid-equal" style={{marginTop:10}}>
        <div className="list-row"><span>Previsto hoje</span><strong>{money(s.receiveToday)}</strong></div>
        <div className="list-row"><span>Recebido hoje</span><strong style={{color:"var(--green)"}}>{money(s.receivedToday)}</strong></div>
        <div className="list-row"><span>Pendente de hoje</span><strong style={{color:s.pendingToday>0?"var(--orange)":undefined}}>{money(s.pendingToday)}</strong></div>
        <div className="list-row"><span>Quitadas</span><strong><CheckCircle2 size={15} style={{verticalAlign:"-2px",marginRight:5}}/>{completeToday}/{todayRows.length}</strong></div>
      </div>
      {pendingTodayRows.length>0&&<div className="list" style={{marginTop:10}}>{pendingTodayRows.slice(0,4).map(x=><div className="list-row" key={x.id}><div><div className="person-name">{x.client?.name}</div><div className="person-meta">{x.loan?.loan_code} · ainda falta hoje</div></div><strong>{money(x.remaining_amount)}</strong></div>)}</div>}
      {todayRows.length===0&&<div className="empty" style={{marginTop:10}}>Nenhuma cobrança prevista para hoje.</div>}
      {todayRows.length>0&&pendingTodayRows.length===0&&<div className="empty" style={{marginTop:10}}>Todas as cobranças previstas para hoje estão quitadas. 🎉</div>}
    </div>

    <DashboardCharts installments={i} payments={p}/>

    <div className="grid-equal" style={{marginTop:16}}>
      <div className="card"><div className="section-title"><h2>Próximos recebimentos</h2><Link href="/calendario" className="muted">Ver todos</Link></div><div className="list">{next.map(x=><div className="list-row" key={x.id}><div className="person"><div className="avatar">{x.client?.name?.[0]}</div><div><div className="person-name">{x.client?.name}</div><div className="person-meta">{x.due_date} · {x.loan?.loan_code}</div></div></div><div style={{textAlign:"right"}}><strong>{money(x.remaining_amount)}</strong><div style={{marginTop:4}}><StatusBadge status={effectiveInstallmentStatus(x,today)}/></div></div></div>)}</div></div>
      <div className="card"><div className="section-title"><h2>🚨 Requer atenção</h2><Link href="/cobrancas-hoje" className="muted">Abrir central</Link></div><div className="list">{late.length?late.map(x=><div className="list-row" key={x.id}><div><div className="person-name">{x.client?.name}</div><div className="person-meta">{x.loan?.loan_code} · {daysOverdue(x.due_date,x.remaining_amount)} dias em atraso</div></div><strong style={{color:"var(--red)"}}>{money(x.remaining_amount)}</strong></div>):<div className="empty">Nenhuma cobrança atrasada 🎉</div>}</div></div>
    </div>
  </>;
}

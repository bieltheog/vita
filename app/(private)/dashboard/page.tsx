import { CashOverview } from "@/components/dashboard/cash-overview";
import Link from "next/link";
import { addDays, format, parseISO } from "date-fns";
import { Wallet, CircleDollarSign, TrendingUp, AlertTriangle, Users, CalendarDays, BadgeDollarSign } from "lucide-react";
import { getDashboardSummary,getInstallments,getHistoricalInstallments,getPayments,getCurrentProfile,getLoans } from "@/lib/data";
import { money,effectiveInstallmentStatus,daysOverdue,realizedProfitForPayment } from "@/lib/finance";
import { brazilDateKey, formatDayRelative } from "@/lib/date";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { PaymentForm } from "@/components/forms/payment-form";
import { EmptyState } from "@/components/ui/empty-state";

export default async function Dashboard(){
  const [s,i,historyInstallments,p,profile,loans]=await Promise.all([getDashboardSummary(),getInstallments(),getHistoricalInstallments(),getPayments(),getCurrentProfile(),getLoans()]);
  const today=brazilDateKey(),month=today.slice(0,7);
  const next=i.filter(x=>Number(x.remaining_amount)>0).sort((a,b)=>a.due_date.localeCompare(b.due_date)).slice(0,6);
  const overdueRows=i.filter(x=>x.stored_status!=="CANCELADO"&&Number(x.remaining_amount)>0&&x.due_date<today);
  const late=overdueRows.slice(0,4);
  const todayRows=historyInstallments.filter(x=>x.due_date===today);
  const pendingTodayRows=todayRows.filter(x=>Number(x.remaining_amount)>0);
  const completeToday=todayRows.filter(x=>Number(x.remaining_amount)<=0).length;
  const receivedMonth=p.filter(x=>x.payment_date.startsWith(month)).reduce((sum,x)=>sum+Number(x.amount),0);
  const loanMap=new Map(loans.map(l=>[l.id,l]));
  const realizedProfit=p.reduce((sum,payment)=>sum+realizedProfitForPayment(payment,loanMap.get(payment.loan_id)),0);
  const monthProfit=historyInstallments.filter(x=>x.due_date.startsWith(month)).reduce((sum,row)=>{const loan=loanMap.get(row.loan_id);if(!loan||Number(loan.total_receivable)<=0)return sum;return sum+Number(row.amount)*(Number(loan.expected_profit)/Number(loan.total_receivable));},0);
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
  const weekRows=historyInstallments.filter(row=>row.due_date>=today&&row.due_date<=weekEnd);
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

  const todayProgress=todayRows.length?Math.round((completeToday/todayRows.length)*100):0;

  return <>
    <div className="page-head">
      <div><h1>Olá, {profile?.full_name}</h1><div className="muted">Resumo da carteira e atalhos para a rotina de cobrança.</div></div>
      <div className="page-actions"><Link className="btn" href="/cobrancas-hoje"><CircleDollarSign size={16}/> Cobranças</Link><PaymentForm installments={i} demo={profile?.demo}/></div>
    </div>

    <div className="stats">
      <CashOverview/>
      <StatCard label="A receber hoje" value={money(s.pendingToday)} meta={todayRows.length?`${completeToday} de ${todayRows.length} cobranças quitadas`:"Nenhuma cobrança prevista hoje"} icon={CircleDollarSign} href="/cobrancas-hoje"/>
      <StatCard label="Atrasado" value={money(s.overdue)} meta={`${overdueRows.length} parcela${overdueRows.length===1?"":"s"} vencida${overdueRows.length===1?"":"s"}`} icon={AlertTriangle} href="/cobrancas-hoje"/>
      <StatCard label="Recebido no mês" value={money(receivedMonth)} icon={CalendarDays} href="/relatorios"/>
    </div>

    <div className="kpi-row">
      <Link className="kpi-mini card-click" href="/emprestimos"><span><Wallet size={14}/> Capital em circulação</span><strong>{money(s.capitalCirculation)}</strong></Link>
      <Link className="kpi-mini card-click" href="/pagamentos"><span><CircleDollarSign size={14}/> Total a receber</span><strong>{money(s.totalReceivable)}</strong></Link>
      <Link className="kpi-mini card-click" href="/relatorios"><span><TrendingUp size={14}/> Lucro contratado</span><strong>{money(s.expectedProfit)}</strong></Link>
      <Link className="kpi-mini card-click" href="/relatorios"><span><BadgeDollarSign size={14}/> Lucro realizado estimado</span><strong>{money(realizedProfit)}</strong></Link>
      <Link className="kpi-mini card-click" href="/relatorios"><span><TrendingUp size={14}/> Lucro previsto no mês</span><strong>{money(monthProfit)}</strong></Link>
      <Link className="kpi-mini card-click" href="/clientes"><span><Users size={14}/> Clientes ativos</span><strong>{s.activeClients}</strong></Link>
      <details className="kpi-mini kpi-details card-click">
        <summary><span><AlertTriangle size={14}/> Inadimplência</span><strong style={{color:delinquencyColor}}>{delinquencyLabel}</strong><small>{money(delinquencyAmount)} vencidos · toque para detalhar</small></summary>
        <div className="kpi-details-body">
          {delinquencyBuckets.map(bucket=><div className="list-row list-row-tight" key={bucket.label}><div><strong>{bucket.label}</strong><div className="person-meta">{bucket.count} parcela{bucket.count===1?"":"s"}</div></div><strong>{money(bucket.amount)}</strong></div>)}
          <div className="person-meta">Percentual calculado sobre o saldo total ainda a receber dos empréstimos ativos.</div>
        </div>
      </details>
    </div>

    <div className="card section-gap">
      <div className="section-title">
        <div><h2>Hoje</h2><div className="person-meta">{todayRows.length?`${completeToday} de ${todayRows.length} cobranças quitadas`:"Nenhuma cobrança prevista para hoje"}</div></div>
        <Link href="/cobrancas-hoje" className="btn secondary">Cobrar agora</Link>
      </div>
      {todayRows.length>0&&<div className="progress" role="progressbar" aria-valuenow={todayProgress} aria-valuemin={0} aria-valuemax={100} aria-label="Cobranças de hoje quitadas"><span style={{width:`${todayProgress}%`}}/></div>}
      <div className="summary-trio">
        <div><span>Previsto</span><strong>{money(s.receiveToday)}</strong></div>
        <div><span>Recebido</span><strong className="money-positive">{money(s.receivedToday)}</strong></div>
        <div><span>Falta receber</span><strong className={s.pendingToday>0?"text-orange":undefined}>{money(s.pendingToday)}</strong></div>
      </div>
      {pendingTodayRows.length>0&&<div className="list list-top">{pendingTodayRows.slice(0,4).map(x=><div className="list-row" key={x.id}><div className="person"><div className="avatar">{x.client?.name?.[0]}</div><div><div className="person-name">{x.client?.name}</div><div className="person-meta">{x.loan?.loan_code}</div></div></div><strong>{money(x.remaining_amount)}</strong></div>)}{pendingTodayRows.length>4&&<Link href="/cobrancas-hoje" className="list-more">Ver mais {pendingTodayRows.length-4}</Link>}</div>}
      {todayRows.length>0&&pendingTodayRows.length===0&&<div className="empty compact">Todas as cobranças de hoje estão quitadas.</div>}
    </div>

    <div className="card section-gap">
      <div className="section-title">
        <div><h2>Próximos 7 dias</h2><div className="person-meta">{formatDayRelative(today,today)} até {format(parseISO(weekEnd),"dd/MM")} · {weekOpenCount} cobrança{weekOpenCount===1?"":"s"} pendente{weekOpenCount===1?"":"s"}</div></div>
        <Link href="/calendario" className="muted">Abrir calendário</Link>
      </div>
      <div className="summary-trio">
        <div><span>Previsto</span><strong>{money(weekExpected)}</strong></div>
        <div><span>Já recebido</span><strong className="money-positive">{money(weekReceived)}</strong></div>
        <div><span>Pendente</span><strong className={weekPending>0?"text-orange":undefined}>{money(weekPending)}</strong></div>
      </div>
      <div className="list list-top">
        {weekDays.map(day=><div className="list-row" key={day.date}><div><div className="person-name">{formatDayRelative(day.date,today)}</div><div className="person-meta">{day.count} cobrança{day.count===1?"":"s"} pendente{day.count===1?"":"s"} · previsto {money(day.expected)}</div></div><div className="text-right"><strong className={day.pending>0?"text-orange":undefined}>{money(day.pending)}</strong>{day.received>0&&<div className="person-meta">{money(day.received)} recebido</div>}</div></div>)}
      </div>
    </div>

    <DashboardCharts installments={i} historicalInstallments={historyInstallments} payments={p}/>

    <div className="grid-equal section-gap">
      <div className="card"><div className="section-title"><h2>Próximos recebimentos</h2><Link href="/calendario" className="muted">Ver todos</Link></div><div className="list">{next.length?next.map(x=><div className="list-row" key={x.id}><div className="person"><div className="avatar">{x.client?.name?.[0]}</div><div><div className="person-name">{x.client?.name}</div><div className="person-meta">{formatDayRelative(x.due_date,today)} · {x.loan?.loan_code}</div></div></div><div className="text-right"><strong>{money(x.remaining_amount)}</strong><div className="badge-gap"><StatusBadge status={effectiveInstallmentStatus(x,today)}/></div></div></div>):<EmptyState title="Nada a receber por enquanto" text="Quando você cadastrar um empréstimo, as próximas parcelas aparecem aqui." action={{href:"/emprestimos?novo=1",label:"Novo empréstimo"}}/>}</div></div>
      <div className="card"><div className="section-title"><h2>Requer atenção</h2><Link href="/cobrancas-hoje" className="muted">Abrir central</Link></div><div className="list">{late.length?late.map(x=><div className="list-row" key={x.id}><div><div className="person-name">{x.client?.name}</div><div className="person-meta">{x.loan?.loan_code} · {daysOverdue(x.due_date,x.remaining_amount)} dias em atraso</div></div><strong className="money-negative">{money(x.remaining_amount)}</strong></div>):<div className="empty compact">Nenhuma cobrança atrasada.</div>}</div></div>
    </div>
  </>;
}

import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, ArrowRight, ChevronDown, Wallet, FileText } from "lucide-react";
import { getActivePortfolio } from "@/lib/portfolio";
import { getLoans, getPayments, getLoanTopups, getDashboardSummary, getInstallments } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { buildCashLedger } from "@/lib/cash-ledger";
import type { CashBaseline, PortfolioCashEntry, CashMovement } from "@/lib/cash-ledger";
import { money } from "@/lib/finance";
import { brazilDateKey } from "@/lib/date";
import { registerOpeningBalanceAction } from "@/app/portfolio-entry-actions";
import { QuickCashActions } from "@/components/cash/quick-cash-actions";

function CashRow({row,showBalance}:{row:CashMovement;showBalance:boolean}){
  const incoming=row.direction==="ENTRADA";
  return <div className="cash-movement">
    <span className={"cash-movement-icon "+(incoming?"cash-movement-icon-in":"cash-movement-icon-out")}>
      {incoming?<ArrowDownLeft size={17}/>:<ArrowUpRight size={17}/>}
    </span>
    <div className="cash-movement-description"><strong>{row.category}</strong><span className="muted">{row.description}</span></div>
    <div className="cash-movement-value"><strong className={incoming?"cash-positive":"cash-negative"}>{incoming?"+":"−"} {money(row.amount)}</strong>
      <span className="muted">{row.date.split("-").reverse().join("/")}{showBalance?" · Saldo "+money(row.balanceAfter):""}</span>
    </div>
  </div>;
}

export default async function WalletsPage(){
  const portfolioId=await getActivePortfolio();
  const today=brazilDateKey();
  const supabase=await createClient();
  const [loans,payments,topups,summary,installments]=await Promise.all([
    getLoans(),getPayments(),getLoanTopups(),getDashboardSummary(),getInstallments()
  ]);
  let entries:PortfolioCashEntry[]=[];
  let baseline:CashBaseline|null=null;
  if(supabase){
    const [activity,opening]=await Promise.all([
      supabase.from("portfolio_entries").select("*").eq("portfolio_id",portfolioId),
      supabase.from("portfolio_cash_baselines").select("*").eq("portfolio_id",portfolioId).maybeSingle()
    ]);
    if(activity.error)throw activity.error;
    if(opening.error)throw opening.error;
    entries=(activity.data||[]) as PortfolioCashEntry[];
    baseline=opening.data as CashBaseline|null;
  }
  const cash=buildCashLedger({loans,payments,topups,entries,baseline});
  const reconciled=portfolioId===2||Boolean(baseline);
  const overdue=installments.filter(i=>i.stored_status!=="CANCELADO"&&i.due_date<today&&Number(i.remaining_amount)>0)
    .reduce((total,i)=>total+Number(i.remaining_amount),0);
  const thisMonth=cash.movements.filter(row=>row.date.startsWith(today.slice(0,7)));
  const receivedMonth=thisMonth.filter(row=>row.delta>0).reduce((s,row)=>s+row.amount,0);
  const spentMonth=thisMonth.filter(row=>row.delta<0).reduce((s,row)=>s+row.amount,0);
  const recent=cash.movements.slice(0,8);
  const older=cash.movements.slice(8);

  return <div className="cash-shell">
    <div className="cash-heading">
      <div><div className="eyebrow">Carteira {portfolioId}</div><h1>Caixa</h1>
        <p className="muted">Acompanhe o que entra, o que sai e quanto está disponível.</p>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
        <Link href="/carteiras/relatorio" className="btn"><FileText size={16}/> Gerar relatório</Link>
        <Link href="/carteiras/detalhes" className="cash-advanced-link">Mais detalhes <ArrowRight size={15}/></Link>
      </div>
    </div>

    <section className="cash-balance">
      <div className="cash-balance-top"><span className="cash-balance-label"><Wallet size={17}/> Saldo disponível</span>
        <span className="cash-wallet-label">Carteira {portfolioId}</span></div>
      <div className={"cash-balance-number"+(reconciled&&cash.balance<0?" cash-balance-negative":"")}>
        {reconciled?money(cash.balance):"Não conciliado"}
      </div>
      <p className="cash-balance-caption">{baseline
        ?"Movimentações desde "+baseline.start_date.split("-").reverse().join("/")
        : portfolioId===1?"Defina o saldo inicial para acompanhar esta carteira com precisão.":"O caixa começa zerado e muda conforme os lançamentos."}</p>
      <div className="cash-balance-month">
        <div><span className="cash-dot cash-dot-green"/><span>Entradas do mês</span><strong className="cash-positive">{money(receivedMonth)}</strong></div>
        <div><span className="cash-dot cash-dot-red"/><span>Saídas do mês</span><strong>{money(spentMonth)}</strong></div>
      </div>
    </section>

    <div className="cash-mini-stats">
      <div className="cash-mini-stat"><span>Capital em circulação</span><strong>{money(summary.capitalCirculation)}</strong></div>
      <div className="cash-mini-stat"><span>Em atraso</span><strong className={overdue>0?"cash-negative":""}>{money(overdue)}</strong></div>
    </div>

    <div className="cash-two-column">
      <section className="cash-panel cash-statement">
        <div className="cash-section-head">
          <div><h2>Movimentações</h2><p className="muted">Entradas e saídas recentes</p></div>
          <Link className="cash-inline-link" href="/relatorios">Relatórios <ArrowRight size={15}/></Link>
        </div>
        {recent.length
          ?<div className="cash-movement-list">{recent.map(row=><CashRow key={row.id} row={row} showBalance={reconciled}/>)}</div>
          :<div className="cash-empty"><Wallet size={22}/><strong>Nenhum movimento ainda</strong><span>Empréstimos, pagamentos e despesas aparecerão aqui.</span></div>}
        {older.length>0&&<details className="cash-more-movements">
          <summary>Ver extrato completo ({cash.movements.length}) <ChevronDown size={16}/></summary>
          <div className="cash-movement-list">{older.map(row=><CashRow key={row.id} row={row} showBalance={reconciled}/>)}</div>
        </details>}
        {entries.some(e=>e.voided_at)&&<p className="cash-tiny muted">Estornos permanecem registrados no histórico detalhado.</p>}
      </section>

      <div className="cash-side">
        <QuickCashActions today={today}/>
        {!baseline&&<details className="cash-panel cash-starting">
          <summary>Configurar saldo inicial <ChevronDown size={17}/></summary>
          <p className="muted">Informe o dinheiro disponível no início da data escolhida. Não registre o mesmo valor novamente como aporte.</p>
          <form action={registerOpeningBalanceAction} className="cash-start-form">
            <div className="field"><label htmlFor="cash-opening">Saldo inicial (R$)</label>
              <input className="input" id="cash-opening" name="opening_balance" type="number" min="0" step="0.01" required/></div>
            <div className="field"><label htmlFor="cash-opening-date">Data</label>
              <input className="input" id="cash-opening-date" name="start_date" type="date" defaultValue={today} required/></div>
            <input type="hidden" name="notes" value="Abertura pelo caixa simplificado"/>
            <button type="submit" className="btn">Salvar saldo inicial</button>
          </form>
        </details>}
        {baseline&&<div className="cash-panel cash-quiet-meta"><span>Saldo de abertura</span>
          <strong>{money(baseline.opening_balance)}</strong><span className="muted">{baseline.start_date.split("-").reverse().join("/")}</span></div>}
        <Link href="/carteiras/detalhes" className="cash-deep-link">Inadimplência, prejuízos e opções avançadas <ArrowRight size={16}/></Link>
      </div>
    </div>
  </div>;
}

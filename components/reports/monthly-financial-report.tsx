import { getLoans,getPayments,getHistoricalInstallments,getLoanTopups } from "@/lib/data";
import { getActivePortfolio } from "@/lib/portfolio";
import { createClient } from "@/lib/supabase/server";
import { money,realizedProfitForPayment } from "@/lib/finance";
import { brazilDateKey } from "@/lib/date";
import { buildCashLedger } from "@/lib/cash-ledger";
import type { CashBaseline,PortfolioCashEntry } from "@/lib/cash-ledger";

export async function MonthlyFinanceReport(){
  const [loans,payments,installments,topups,portfolioId,supabase]=await Promise.all([
    getLoans(),getPayments(),getHistoricalInstallments(),getLoanTopups(),getActivePortfolio(),createClient()
  ]);
  const [ledgerResult,baseResult]=supabase?await Promise.all([
    supabase.from("portfolio_entries").select("*").eq("portfolio_id",portfolioId),
    supabase.from("portfolio_cash_baselines").select("*").eq("portfolio_id",portfolioId).maybeSingle()
  ]):[{data:[],error:null},{data:null,error:null}];
  if(ledgerResult.error)throw ledgerResult.error;
  if(baseResult.error)throw baseResult.error;
  const ledger=((ledgerResult.data||[]) as PortfolioCashEntry[]).filter(e=>!e.voided_at);
  const baseline=baseResult.data as CashBaseline|null;
  const cash=buildCashLedger({loans,payments,topups,entries:ledger,baseline});
  const monthList=Array.from(new Set([
    brazilDateKey().slice(0,7),
    ...loans.map(l=>l.start_date.slice(0,7)),
    ...topups.map(t=>t.topup_date.slice(0,7)),
    ...payments.map(p=>p.payment_date.slice(0,7)),
    ...ledger.map(e=>e.entry_date.slice(0,7)),
  ])).filter(m=>!baseline||m>=baseline.start_date.slice(0,7)).sort().reverse();
  const loanMap=new Map(loans.map(l=>[l.id,l]));
  const extras=new Map<string,number>();
  topups.forEach(t=>extras.set(t.loan_id,(extras.get(t.loan_id)||0)+Number(t.amount)));
  const today=brazilDateKey();
  const periods=monthList.map(month=>{
    const monthOf=(date:string)=>date.startsWith(month);
    const ps=payments.filter(p=>monthOf(p.payment_date)&&(!baseline||p.payment_date>=baseline.start_date));
    const es=ledger.filter(e=>monthOf(e.entry_date)&&(!baseline||e.entry_date>=baseline.start_date));
    const amt=(kind:string)=>es.filter(e=>e.kind===kind).reduce((s,e)=>s+Number(e.amount),0);
    const disbursed=loans.filter(l=>monthOf(l.start_date)&&(!baseline||l.start_date>=baseline.start_date)).reduce((s,l)=>s+Number(l.principal_amount)-(extras.get(l.id)||0),0)
      +topups.filter(t=>monthOf(t.topup_date)&&(!baseline||t.topup_date>=baseline.start_date)).reduce((s,t)=>s+Number(t.amount),0);
    const received=ps.reduce((s,p)=>s+Number(p.amount),0);
    const interest=ps.reduce((s,p)=>s+realizedProfitForPayment(p,loanMap.get(p.loan_id)),0);
    const overdue=installments.filter(i=>i.due_date<today&&monthOf(i.due_date))
      .reduce((s,i)=>s+Number(i.remaining_amount),0);
    const costs=amt("DESPESA")+amt("JUROS_FINANCIAMENTO");
    const loss=amt("PERDA")-amt("RECUPERACAO");
    const flow=cash.movements.filter(x=>monthOf(x.date)).reduce((sum,x)=>sum+x.delta,0);
    const balanceAtEnd=cash.openingBalance+cash.movements
      .filter(x=>x.date.slice(0,7)<=month).reduce((sum,x)=>sum+x.delta,0);
    return {month,disbursed,received,interest,overdue,costs,loss,result:interest-costs-loss,cashFlow:flow,balanceAtEnd};
  });
  return <div className="card" style={{marginTop:16}}>
    <div className="section-title"><div><h2>Fechamento mensal · Carteira {portfolioId}</h2>
      <div className="muted">Inadimplência, perdas reconhecidas, resultado e fluxo de caixa, separados por carteira.</div></div></div>
    <div className="table-wrap"><table><thead><tr>
      <th>Mês</th><th>Emprestado</th><th>Recebido</th><th>Juros realizados</th>
      <th>Vencido aberto</th><th>Despesas e custo financeiro</th><th>Perda líquida</th><th>Resultado</th><th>Fluxo de caixa</th><th>Saldo final do mês</th>
    </tr></thead><tbody>{periods.map(row=><tr key={row.month}>
      <td>{row.month}</td><td>{money(row.disbursed)}</td><td>{money(row.received)}</td>
      <td>{money(row.interest)}</td><td>{money(row.overdue)}</td><td>{money(row.costs)}</td>
      <td>{money(row.loss)}</td><td>{money(row.result)}</td><td>{money(row.cashFlow)}</td><td>{portfolioId===1&&!baseline?"Não conciliado":money(row.balanceAtEnd)}</td>
    </tr>)}</tbody></table></div>
    <div className="alert" style={{marginTop:14}}>
      {portfolioId===1&&!baseline
        ?"Na Carteira 1, ainda falta cadastrar o caixa inicial para conciliar. Histórico antigo preservado."
        :baseline
          ?"Saldo concilia a partir da abertura registrada em "+baseline.start_date+"."
          :"Carteira 2 inicia em R$ 0. Registre o capital efetivamente recebido antes de conceder empréstimos."}
      Atraso não representa perda definitiva. Aportes e amortizações de dívida não são lucro ou prejuízo.
    </div>
  </div>;
}

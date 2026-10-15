import { getLoans,getPayments,getHistoricalInstallments,getLoanTopups } from "@/lib/data";
import { getActivePortfolio } from "@/lib/portfolio";
import { createClient } from "@/lib/supabase/server";
import { money,realizedProfitForPayment } from "@/lib/finance";
import { brazilDateKey } from "@/lib/date";

export async function MonthlyFinanceReport(){
  const [loans,payments,installments,topups,portfolioId,supabase]=await Promise.all([
    getLoans(),getPayments(),getHistoricalInstallments(),getLoanTopups(),getActivePortfolio(),createClient()
  ]);
  const {data:entries,error}=supabase?await supabase.from("portfolio_entries").select("kind,amount,entry_date")
    .eq("portfolio_id",portfolioId).is("voided_at",null):{data:[],error:null};
  if(error)throw error;
  const ledger=(entries||[]) as Array<{kind:string;amount:number;entry_date:string}>;
  const monthList=Array.from(new Set([
    brazilDateKey().slice(0,7),
    ...loans.map(l=>l.start_date.slice(0,7)),
    ...topups.map(t=>t.topup_date.slice(0,7)),
    ...payments.map(p=>p.payment_date.slice(0,7)),
    ...ledger.map(e=>e.entry_date.slice(0,7)),
  ])).sort().reverse();
  const loanMap=new Map(loans.map(l=>[l.id,l]));
  const extras=new Map<string,number>();
  topups.forEach(t=>extras.set(t.loan_id,(extras.get(t.loan_id)||0)+Number(t.amount)));
  const today=brazilDateKey();
  const periods=monthList.map(month=>{
    const monthOf=(date:string)=>date.startsWith(month);
    const ps=payments.filter(p=>monthOf(p.payment_date));
    const es=ledger.filter(e=>monthOf(e.entry_date));
    const amt=(kind:string)=>es.filter(e=>e.kind===kind).reduce((s,e)=>s+Number(e.amount),0);
    const disbursed=loans.filter(l=>monthOf(l.start_date)).reduce((s,l)=>s+Number(l.principal_amount)-(extras.get(l.id)||0),0)
      +topups.filter(t=>monthOf(t.topup_date)).reduce((s,t)=>s+Number(t.amount),0);
    const received=ps.reduce((s,p)=>s+Number(p.amount),0);
    const interest=ps.reduce((s,p)=>s+realizedProfitForPayment(p,loanMap.get(p.loan_id)),0);
    const overdue=installments.filter(i=>i.due_date<today&&monthOf(i.due_date))
      .reduce((s,i)=>s+Number(i.remaining_amount),0);
    const costs=amt("DESPESA")+amt("JUROS_FINANCIAMENTO");
    const loss=amt("PERDA")-amt("RECUPERACAO");
    const flow=received-disbursed+amt("APORTE")+amt("CREDITO")
      -amt("RETIRADA")-amt("AMORTIZACAO_DIVIDA")-costs;
    return {month,disbursed,received,interest,overdue,costs,loss,result:interest-costs-loss,cashFlow:flow};
  });
  return <div className="card" style={{marginTop:16}}>
    <div className="section-title"><div><h2>Fechamento mensal · Carteira {portfolioId}</h2>
      <div className="muted">Inadimplência, perdas reconhecidas, resultado e fluxo de caixa, separados por carteira.</div></div></div>
    <div className="table-wrap"><table><thead><tr>
      <th>Mês</th><th>Emprestado</th><th>Recebido</th><th>Juros realizados</th>
      <th>Vencido aberto</th><th>Despesas e custo financeiro</th><th>Perda líquida</th><th>Resultado</th><th>Fluxo de caixa</th>
    </tr></thead><tbody>{periods.map(row=><tr key={row.month}>
      <td>{row.month}</td><td>{money(row.disbursed)}</td><td>{money(row.received)}</td>
      <td>{money(row.interest)}</td><td>{money(row.overdue)}</td><td>{money(row.costs)}</td>
      <td>{money(row.loss)}</td><td>{money(row.result)}</td><td>{money(row.cashFlow)}</td>
    </tr>)}</tbody></table></div>
    <div className="alert" style={{marginTop:14}}>
      {portfolioId===1
        ?"Na Carteira 1, os saldos anteriores aos controles novos não foram conciliados. Valores de juros e caixa são estimativas; o histórico permanece intacto."
        :"O fluxo da Carteira 2 considera os recebimentos reais e os lançamentos registrados. Lance todos os aportes, saídas e parcelas do financiamento para conciliar o caixa."}
      Atraso não representa perda definitiva. Aportes e amortizações de dívida não são lucro ou prejuízo.
    </div>
  </div>;
}

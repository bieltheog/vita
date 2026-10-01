import {getDashboardSummary,getClients,getLoans,getPayments,getHistoricalInstallments} from '@/lib/data';
import {money,realizedProfitForPayment} from '@/lib/finance';
import {ExportButtons} from '@/components/reports/export-buttons';

export default async function ReportsPage(){
  const[summary,clients,loans,payments,installments]=await Promise.all([getDashboardSummary(),getClients(),getLoans(),getPayments(),getHistoricalInstallments()]);
  const validLoans=loans.filter(l=>l.status!=="CANCELADO");
  const ranking=clients.map(x=>({n:x.name,p:payments.filter(y=>y.client_id===x.id).reduce((a,b)=>a+Number(b.amount),0)})).filter(x=>x.p>0).sort((a,b)=>b.p-a.p);
  const loanMap=new Map(loans.map(l=>[l.id,l]));
  const realizedProfit=payments.reduce((sum,p)=>sum+realizedProfitForPayment(p,loanMap.get(p.loan_id)),0);
  const totalPrincipal=validLoans.reduce((a,b)=>a+Number(b.principal_amount),0);
  const movements=[
    ...payments.map(x=>({d:x.payment_date.slice(0,10),n:x.client?.name||"Cliente",t:'Pagamento recebido',v:Number(x.amount)})),
    ...validLoans.map(x=>({d:x.start_date,n:x.client?.name||"Cliente",t:'Novo empréstimo',v:-Number(x.principal_amount)})),
  ].sort((a,b)=>b.d.localeCompare(a.d));

  return <>
    <div className="page-head">
      <div><div className="eyebrow">Inteligência</div><h1>Relatórios</h1><div className="muted">Indicadores, movimentações, exportação e backup em um só lugar. Contratos cancelados ficam fora do saldo atual; pagamentos realmente recebidos continuam no histórico.</div></div>
      <ExportButtons clients={clients} loans={loans} installments={installments} payments={payments}/>
    </div>

    <div className="stats">
      <div className="card"><div className="muted">Total emprestado</div><div className="stat-value">{money(totalPrincipal)}</div></div>
      <div className="card"><div className="muted">Total recebido</div><div className="stat-value">{money(summary.totalReceived)}</div></div>
      <div className="card"><div className="muted">Saldo atual a receber</div><div className="stat-value">{money(summary.totalReceivable)}</div></div>
      <div className="card"><div className="muted">Lucro contratado ativo</div><div className="stat-value">{money(summary.expectedProfit)}</div></div>
      <div className="card"><div className="muted">Lucro realizado estimado</div><div className="stat-value">{money(realizedProfit)}</div></div>
      <div className="card"><div className="muted">A receber no mês</div><div className="stat-value">{money(summary.monthExpected)}</div></div>
      <div className="card"><div className="muted">Valor atrasado</div><div className="stat-value">{money(summary.overdue)}</div></div>
      <div className="card"><div className="muted">Movimentações</div><div className="stat-value">{movements.length}</div></div>
    </div>

    <div className="grid-equal" style={{marginTop:16}}>
      <div className="card"><h2>Ranking de clientes por valor recebido</h2><div className="list">{ranking.length?ranking.map((x,k)=><div className="list-row" key={x.n}><div><strong>#{k+1} {x.n}</strong><div className="person-meta">Pagamentos efetivamente recebidos</div></div><strong>{money(x.p)}</strong></div>):<div className="empty">Nenhum pagamento registrado.</div>}</div></div>
      <div className="card"><h2>Indicadores da carteira</h2><div className="list"><div className="list-row"><span>Clientes cadastrados</span><strong>{clients.length}</strong></div><div className="list-row"><span>Empréstimos não cancelados</span><strong>{validLoans.length}</strong></div><div className="list-row"><span>Parcelas não canceladas</span><strong>{installments.length}</strong></div><div className="list-row"><span>Pagamentos recebidos</span><strong>{payments.length}</strong></div></div><div className="alert" style={{marginTop:14}}>“Lucro realizado estimado” distribui proporcionalmente o lucro contratado sobre cada pagamento recebido; não é uma apuração contábil/fiscal.</div></div>
    </div>

    <div className="card" style={{marginTop:16}}>
      <div className="section-title"><div><h2>Movimentações registradas</h2><div className="person-meta">Empréstimos não cancelados e todos os pagamentos efetivamente recebidos</div></div><span className="badge gray">{movements.length}</span></div>
      <div className="list">{movements.length?movements.map((x,k)=><div className="list-row" key={`${x.d}-${x.n}-${x.t}-${k}`}><div><strong>{x.n}</strong><div className="person-meta">{x.d} · {x.t}</div></div><strong style={{color:x.v>=0?'var(--green)':'var(--red)'}}>{x.v>=0?'+ ':'- '}{money(Math.abs(x.v))}</strong></div>):<div className="empty">Nenhuma movimentação registrada.</div>}</div>
    </div>
  </>;
}

import { getInstallments, getPayments } from "@/lib/data";
import { brazilDateKey } from "@/lib/date";
import { effectiveInstallmentStatus, money } from "@/lib/finance";
import { StatusBadge } from "@/components/ui/status-badge";
import { PrintPageButton } from "@/components/ui/print-page-button";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";

export default async function DailyClosingPage(){
  const today=brazilDateKey();
  const [installments,payments]=await Promise.all([getInstallments(),getPayments()]);
  const todayRows=installments.filter(i=>i.due_date===today);
  const paidToday=payments.filter(p=>p.payment_date.slice(0,10)===today);
  const expected=todayRows.reduce((s,i)=>s+Number(i.amount),0);
  const received=paidToday.reduce((s,p)=>s+Number(p.amount),0);
  const pending=todayRows.reduce((s,i)=>s+Number(i.remaining_amount),0);
  const overdue=installments.filter(i=>effectiveInstallmentStatus(i,today)==="ATRASADO").reduce((s,i)=>s+Number(i.remaining_amount),0);
  const complete=todayRows.filter(i=>Number(i.remaining_amount)<=0).length;
  const pendingRows=todayRows.filter(i=>Number(i.remaining_amount)>0);
  return <>
    <div className="page-head"><div><div className="eyebrow">Conferência</div><h1>Fechamento diário</h1><div className="muted">Resumo do que deveria entrar, do que entrou e do que ficou pendente em {today}.</div></div><PrintPageButton/></div>
    <div className="stats"><div className="card"><div className="muted">Previsto hoje</div><div className="stat-value">{money(expected)}</div></div><div className="card"><div className="muted">Recebido hoje</div><div className="stat-value">{money(received)}</div></div><div className="card"><div className="muted">Pendente de hoje</div><div className="stat-value">{money(pending)}</div></div><div className="card"><div className="muted">Atrasado total</div><div className="stat-value">{money(overdue)}</div></div></div>
    <div className="grid-equal" style={{marginTop:16}}><div className="card"><div className="section-title"><h2>Resumo das cobranças</h2><span className="badge green">{complete}/{todayRows.length} quitadas</span></div><div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Parcela</th><th>Valor</th><th>Recebido</th><th>Saldo</th><th>Status</th></tr></thead><tbody>{todayRows.map(i=><tr key={i.id}><td><strong>{i.client?.name}</strong><div className="person-meta">{i.loan?.loan_code}</div></td><td>{i.installment_number}/{i.loan?.installment_count}</td><td>{money(i.amount)}</td><td>{money(i.amount_paid)}</td><td>{money(i.remaining_amount)}</td><td><StatusBadge status={effectiveInstallmentStatus(i,today)}/></td></tr>)}</tbody></table></div></div><div className="card"><div className="section-title"><h2>Quem ainda falta pagar</h2><span className="badge gray">{pendingRows.length}</span></div><div className="list">{pendingRows.length?pendingRows.map(i=><div className="list-row" key={i.id}><div><div className="person-name">{i.client?.name}</div><div className="person-meta">{i.loan?.loan_code} · saldo {money(i.remaining_amount)}</div></div><WhatsAppButton compact phone={i.client?.whatsapp||i.client?.phone} message={`Olá, ${i.client?.name||""}! Sua parcela de ${money(i.remaining_amount)} prevista para hoje ainda consta em aberto. Se já pagou, desconsidere.`}/></div>):<div className="empty">Todas as cobranças de hoje estão quitadas.</div>}</div></div></div>
  </>;
}

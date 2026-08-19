import { notFound } from "next/navigation";
import { getClient, getLoans, getPayments, getInstallments, getActivityLogs, getCurrentProfile } from "@/lib/data";
import { money, effectiveInstallmentStatus } from "@/lib/finance";
import { StatusBadge } from "@/components/ui/status-badge";
import { EditClientForm } from "@/components/forms/edit-client-form";
import { LoanForm } from "@/components/forms/loan-form";
import { RenegotiateInstallment } from "@/components/forms/renegotiate-installment";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";
import { ReceiptButton } from "@/components/ui/receipt-button";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [c, loans, payments, inst, logs, profile] = await Promise.all([
    getClient(id), getLoans(id), getPayments(id), getInstallments({ clientId: id }), getActivityLogs(400), getCurrentProfile(),
  ]);
  if (!c) notFound();

  const principal = loans.reduce((s,l)=>s+Number(l.principal_amount),0);
  const contracted = loans.reduce((s,l)=>s+Number(l.total_receivable),0);
  const expectedProfit = loans.reduce((s,l)=>s+Number(l.expected_profit),0);
  const paid = payments.reduce((s,p)=>s+Number(p.amount),0);
  const outstanding = inst.reduce((s,i)=>s+Number(i.remaining_amount),0);
  const overdue = inst.filter(i=>effectiveInstallmentStatus(i)==="ATRASADO").reduce((s,i)=>s+Number(i.remaining_amount),0);
  const active=loans.filter(l=>l.status==="ATIVO").length;
  const ids=new Set([c.id,...loans.map(l=>l.id),...payments.map(p=>p.id),...inst.map(i=>i.id)]);
  const history=logs.filter(l=>l.entity_id&&ids.has(l.entity_id)).slice(0,40);
  const phone=c.whatsapp||c.phone;

  return <>
    <div className="page-head"><div><div className="eyebrow">Perfil financeiro</div><h1>{c.name}</h1><div className="muted">{c.phone||"Sem telefone"} · {c.city||"Cidade não informada"} {c.state||""}</div></div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><WhatsAppButton phone={phone} message={`Olá, ${c.name}! Estou entrando em contato sobre seu cadastro financeiro. Seu saldo atual é ${money(outstanding)}.`}/><LoanForm clients={[c]} initialClientId={c.id} buttonLabel="Novo empréstimo" demo={profile?.demo}/><EditClientForm client={c}/></div></div>

    <div className="stats"><div className="card"><div className="muted">Total emprestado</div><div className="stat-value">{money(principal)}</div></div><div className="card"><div className="muted">Lucro contratado</div><div className="stat-value">{money(expectedProfit)}</div></div><div className="card"><div className="muted">Já recebido</div><div className="stat-value">{money(paid)}</div></div><div className="card"><div className="muted">Saldo em aberto</div><div className="stat-value">{money(outstanding)}</div></div><div className="card"><div className="muted">Atrasado</div><div className="stat-value" style={{color:overdue>0?"var(--red)":"inherit"}}>{money(overdue)}</div></div><div className="card"><div className="muted">Empréstimos ativos</div><div className="stat-value">{active}</div></div></div>

    <div className="grid-equal" style={{marginTop:16}}><div className="card"><div className="section-title"><h2>Empréstimos</h2><span className="muted">Contratado: {money(contracted)}</span></div><div className="list">{loans.length?loans.map(l=><a href={`/emprestimos/${l.id}`} className="list-row" key={l.id}><div><strong>{l.loan_code}</strong><div className="person-meta">{l.installment_count} parcelas · {l.payment_frequency} · {l.status}</div></div><div style={{textAlign:"right"}}><strong>{money(l.total_receivable)}</strong><div className="person-meta">lucro {money(l.expected_profit)}</div></div></a>):<div className="empty">Nenhum empréstimo.</div>}</div></div><div className="card"><div className="section-title"><h2>Pagamentos recentes</h2><span className="badge green">{payments.length}</span></div><div className="list">{payments.slice(0,12).map(p=><div className="list-row" key={p.id}><div><strong>+ {money(p.amount)}</strong><div className="person-meta">{p.payment_date} · {p.payment_method} · {p.loan?.loan_code}</div></div><ReceiptButton clientName={c.name} loanCode={p.loan?.loan_code} amount={Number(p.amount)} paymentDate={p.payment_date} paymentMethod={p.payment_method}/></div>)}</div></div></div>

    <div className="card" style={{marginTop:16}}><div className="section-title"><div><h2>Parcelas</h2><div className="muted" style={{fontSize:12}}>Data original, vencimento atual e ações de renegociação.</div></div></div><div className="table-wrap"><table><thead><tr><th>Empréstimo</th><th>Parcela</th><th>Original</th><th>Vencimento</th><th>Valor</th><th>Pago</th><th>Restante</th><th>Status</th><th></th></tr></thead><tbody>{inst.map(i=><tr key={i.id}><td>{i.loan?.loan_code}</td><td>{i.installment_number}/{i.loan?.installment_count}</td><td>{i.original_due_date}</td><td>{i.due_date}</td><td>{money(i.amount)}</td><td>{money(i.amount_paid)}</td><td>{money(i.remaining_amount)}</td><td><StatusBadge status={effectiveInstallmentStatus(i)}/></td><td><RenegotiateInstallment installment={i} compact/></td></tr>)}</tbody></table></div></div>

    <div className="card" style={{marginTop:16}}><div className="section-title"><div><h2>Histórico de alterações</h2><div className="muted" style={{fontSize:12}}>Edições, pagamentos, estornos, reagendamentos e renegociações.</div></div><span className="badge gray">{history.length}</span></div><div className="list">{history.length?history.map(log=><div className="list-row" key={log.id}><div><strong>{log.description||log.action}</strong><div className="person-meta">{new Date(log.created_at).toLocaleString("pt-BR")} · {log.entity_type}</div></div></div>):<div className="empty">Ainda não há alterações registradas.</div>}</div></div>
  </>;
}

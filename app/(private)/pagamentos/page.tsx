import {getInstallments,getCurrentProfile,getPayments} from '@/lib/data';
import {money,effectiveInstallmentStatus,daysOverdue} from '@/lib/finance';
import {StatusBadge} from '@/components/ui/status-badge';
import {PaymentForm} from '@/components/forms/payment-form';
import {ReceiptButton} from '@/components/ui/receipt-button';
import {RenegotiateInstallment} from '@/components/forms/renegotiate-installment';

export default async function PaymentsPage(){
  const[installments,profile,payments]=await Promise.all([getInstallments(),getCurrentProfile(),getPayments()]);
  return <><div className="page-head"><div><div className="eyebrow">Cobranças</div><h1>Pagamentos</h1><div className="muted">Parcelas pagas, pendentes, parciais e atrasadas, com recibo e renegociação.</div></div><PaymentForm installments={installments} demo={profile?.demo}/></div>
  <div className="card"><div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Empréstimo</th><th>Parcela</th><th>Vencimento</th><th>Valor</th><th>Pago</th><th>Restante</th><th>Status</th><th></th></tr></thead><tbody>{installments.map(x=>{const s=effectiveInstallmentStatus(x);return <tr key={x.id}><td><strong>{x.client?.name}</strong>{s==='ATRASADO'&&<div className="person-meta">{daysOverdue(x.due_date,x.remaining_amount)} dias em atraso</div>}</td><td>{x.loan?.loan_code}</td><td>{x.installment_number}/{x.loan?.installment_count}</td><td>{x.due_date}</td><td>{money(x.amount)}</td><td>{money(x.amount_paid)}</td><td>{money(x.remaining_amount)}</td><td><StatusBadge status={s}/></td><td><RenegotiateInstallment installment={x} compact/></td></tr>})}</tbody></table></div></div>
  <div className="card" style={{marginTop:16}}><div className="section-title"><div><h2>Histórico de recebimentos</h2><div className="muted" style={{fontSize:12}}>Abra o recibo para imprimir ou salvar em PDF.</div></div><span className="badge green">{payments.length}</span></div><div className="table-wrap"><table><thead><tr><th>Data</th><th>Cliente</th><th>Empréstimo</th><th>Forma</th><th>Valor</th><th>Recibo</th></tr></thead><tbody>{payments.map(p=><tr key={p.id}><td>{p.payment_date}</td><td>{p.client?.name}</td><td>{p.loan?.loan_code}</td><td>{p.payment_method}</td><td><strong style={{color:"var(--green)"}}>{money(p.amount)}</strong></td><td><ReceiptButton clientName={p.client?.name||"Cliente"} loanCode={p.loan?.loan_code} amount={Number(p.amount)} paymentDate={p.payment_date} paymentMethod={p.payment_method}/></td></tr>)}</tbody></table></div></div></>
}

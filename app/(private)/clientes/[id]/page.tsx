import { notFound } from "next/navigation";
import { getClient, getLoans, getPayments, getInstallments } from "@/lib/data";
import { money, effectiveInstallmentStatus } from "@/lib/finance";
import { StatusBadge } from "@/components/ui/status-badge";
import { EditClientForm } from "@/components/forms/edit-client-form";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [c, loans, payments, inst] = await Promise.all([
    getClient(id),
    getLoans(id),
    getPayments(id),
    getInstallments({ clientId: id }),
  ]);

  if (!c) notFound();

  const principal = loans.reduce((s, l) => s + Number(l.principal_amount), 0);
  const total = loans.reduce((s, l) => s + Number(l.total_receivable), 0);
  const paid = payments.reduce((s, p) => s + Number(p.amount), 0);

  return <>
    <div className="page-head">
      <div>
        <div className="eyebrow">Perfil do cliente</div>
        <h1>{c.name}</h1>
        <div className="muted">{c.phone || "Sem telefone"} · {c.city || "Cidade não informada"} {c.state || ""}</div>
      </div>
      <EditClientForm client={c}/>
    </div>

    <div className="stats">
      <div className="card"><div className="muted">Total emprestado</div><div className="stat-value">{money(principal)}</div></div>
      <div className="card"><div className="muted">Total a retornar</div><div className="stat-value">{money(total)}</div></div>
      <div className="card"><div className="muted">Já pago</div><div className="stat-value">{money(paid)}</div></div>
      <div className="card"><div className="muted">Pendente</div><div className="stat-value">{money(Math.max(0, total - paid))}</div></div>
    </div>

    <div className="grid-equal" style={{ marginTop: 16 }}>
      <div className="card">
        <h2>Empréstimos</h2>
        <div className="list">{loans.map(l => <div className="list-row" key={l.id}><div><strong>{l.loan_code}</strong><div className="person-meta">{l.installment_count} parcelas · {l.return_percentage?.toFixed(1)}%</div></div><strong>{money(l.total_receivable)}</strong></div>)}</div>
      </div>
      <div className="card">
        <h2>Extrato / histórico</h2>
        <div className="list">{payments.map(p => <div className="list-row" key={p.id}><div><strong>Pagamento recebido</strong><div className="person-meta">{p.payment_date} · {p.payment_method}</div></div><strong style={{ color: "var(--green)" }}>+ {money(p.amount)}</strong></div>)}</div>
      </div>
    </div>

    <div className="card" style={{ marginTop: 16 }}>
      <h2>Parcelas</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Parcela</th><th>Vencimento</th><th>Valor</th><th>Pago</th><th>Restante</th><th>Status</th></tr></thead>
          <tbody>{inst.map(i => <tr key={i.id}><td>{i.installment_number}/{i.loan?.installment_count}</td><td>{i.due_date}</td><td>{money(i.amount)}</td><td>{money(i.amount_paid)}</td><td>{money(i.remaining_amount)}</td><td><StatusBadge status={effectiveInstallmentStatus(i)}/></td></tr>)}</tbody>
        </table>
      </div>
    </div>
  </>;
}

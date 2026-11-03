import type { Installment } from "@/lib/types";

/** Soma o que já foi pago e o total das parcelas válidas (ignora canceladas). */
export function loanPaidTotals(rows: Installment[]) {
  let paid = 0, remaining = 0;
  for (const row of rows) {
    if (row.stored_status === "CANCELADO") continue;
    paid += Number(row.amount_paid) || 0;
    remaining += Number(row.remaining_amount) || 0;
  }
  return { paid, total: paid + remaining };
}

/** Barra fina com o percentual já pago de um empréstimo. */
export function LoanProgress({ paid, total }: { paid: number; total: number }) {
  const percent = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  return <div className="loan-progress" title={`${percent}% pago`}>
    <div className="progress progress-sm" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Percentual pago"><span style={{ width: `${percent}%` }} /></div>
    <small>{percent}% pago</small>
  </div>;
}

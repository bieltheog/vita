import { getInstallments } from "@/lib/data";
import { brazilDateKey } from "@/lib/date";
import { TodayCollections } from "@/components/collections/today-collections";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TodayCollectionsPage() {
  const todayKey = brazilDateKey();
  const installments = await getInstallments();

  // O saldo restante é a fonte de verdade da cobrança. Não confiar no status
  // derivado/gravado, que pode ficar divergente após pagamentos parciais,
  // renegociações ou alterações de empréstimos.
  // Qualquer parcela não cancelada com saldo > 0 e vencimento hoje/anterior
  // deve aparecer: atrasada, parcial atrasada ou vencimento do dia.
  const collectible = installments.filter((row) => {
    const remaining = Number(row.remaining_amount || 0);
    if (remaining <= 0) return false;
    return row.due_date <= todayKey;
  });

  return (
    <>
      <div className="page-head collections-page-head">
        <div>
          <div className="eyebrow">Central de cobrança</div>
          <h1>Cobranças</h1>
          <div className="muted">
            Todos que precisam ser cobrados: atrasados, parciais e vencimentos de hoje.
          </div>
        </div>
      </div>
      <TodayCollections items={collectible} dateKey={todayKey} />
    </>
  );
}

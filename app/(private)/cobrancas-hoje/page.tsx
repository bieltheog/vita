import { getInstallments } from "@/lib/data";
import { brazilDateKey } from "@/lib/date";
import { effectiveInstallmentStatus } from "@/lib/finance";
import { TodayCollections } from "@/components/collections/today-collections";

// Cobranças dependem do estado atual do banco. Não deixar esta página usar
// conteúdo estático/cacheado, senão parcelas recém-criadas ou pagamentos
// registrados podem demorar para aparecer na central.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TodayCollectionsPage() {
  const todayKey = brazilDateKey();
  const installments = await getInstallments();

  // A central deve mostrar TODA parcela que ainda tem saldo e que já deveria
  // estar sendo cobrada hoje: atrasadas, parciais e vencimentos do dia.
  // O saldo restante é a fonte de verdade; status gravado pode ficar defasado.
  const collectible = installments.filter((row) => {
    const remaining = Number(row.remaining_amount || 0);
    if (remaining <= 0) return false;

    const status = effectiveInstallmentStatus(row, todayKey);
    if (status === "CANCELADO" || status === "PAGO") return false;

    return row.due_date <= todayKey || Number(row.amount_paid || 0) > 0;
  });

  return (
    <>
      <div className="page-head collections-page-head">
        <div>
          <div className="eyebrow">Central de cobrança</div>
          <h1>Cobranças</h1>
          <div className="muted">
            Todos que precisam ser cobrados em uma fila única: atrasados, parciais e vencimentos de hoje.
          </div>
        </div>
      </div>
      <TodayCollections items={collectible} dateKey={todayKey} />
    </>
  );
}

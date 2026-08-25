import { getInstallments } from "@/lib/data";
import { brazilDateKey } from "@/lib/date";
import { effectiveInstallmentStatus } from "@/lib/finance";
import { TodayCollections } from "@/components/collections/today-collections";

export default async function TodayCollectionsPage() {
  const todayKey=brazilDateKey();
  const installments=await getInstallments();

  const collectible=installments.filter(row=>{
    const status=effectiveInstallmentStatus(row,todayKey);
    const remaining=Number(row.remaining_amount);
    if(remaining<=0||status==="CANCELADO"||status==="PAGO") return false;
    return row.due_date<=todayKey || status==="PARCIAL";
  });

  return <>
    <div className="page-head collections-page-head">
      <div>
        <div className="eyebrow">Central de cobrança</div>
        <h1>Cobranças</h1>
        <div className="muted">Todos que precisam ser cobrados em uma fila única: atrasados, parciais e vencimentos de hoje.</div>
      </div>
    </div>
    <TodayCollections items={collectible} dateKey={todayKey}/>
  </>;
}

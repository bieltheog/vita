import { getInstallments } from "@/lib/data";
import { brazilDateKey } from "@/lib/date";
import { effectiveInstallmentStatus } from "@/lib/finance";
import { TodayCollections } from "@/components/collections/today-collections";

export default async function TodayCollectionsPage() {
  const todayKey=brazilDateKey();
  const installments=await getInstallments();
  const today=installments.filter(row=>row.due_date===todayKey && effectiveInstallmentStatus(row,todayKey)!=="CANCELADO");
  const overdue=installments.filter(row=>row.due_date<todayKey && effectiveInstallmentStatus(row,todayKey)==="ATRASADO");
  return <>
    <div className="page-head"><div><div className="eyebrow">Rotina diária</div><h1>Cobranças de hoje</h1><div className="muted">Veja quem precisa pagar, cobre pelo WhatsApp e dê baixa sem sair desta tela.</div></div></div>
    <TodayCollections today={today} overdue={overdue} dateKey={todayKey}/>
  </>;
}

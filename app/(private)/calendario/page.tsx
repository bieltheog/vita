import { getInstallments, getHistoricalInstallments, getCurrentProfile } from "@/lib/data";
import { CalendarBoard } from "@/components/calendar/calendar-board";
import { PaymentForm } from "@/components/forms/payment-form";
import { InterestOnlyForm } from "@/components/forms/interest-only-form";

export default async function P(){
  const [activeInstallments,historyInstallments,profile]=await Promise.all([
    getInstallments(),
    getHistoricalInstallments(),
    getCurrentProfile(),
  ]);
  return <>
    <div className="page-head">
      <div>
        <div className="eyebrow">Agenda financeira</div>
        <h1>Calendário financeiro</h1>
        <div className="muted">Recebimentos dos clientes, parcelas pagas e pendências no mesmo calendário.</div>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><PaymentForm installments={activeInstallments} demo={profile?.demo} compact/><InterestOnlyForm installments={activeInstallments} demo={profile?.demo}/></div>
    </div>
    <CalendarBoard installments={historyInstallments}/>
  </>;
}

import { getInstallments, getHistoricalInstallments, getCurrentProfile } from "@/lib/data";
import { CalendarBoard } from "@/components/calendar/calendar-board";
import { PaymentForm } from "@/components/forms/payment-form";

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
      <PaymentForm installments={activeInstallments} demo={profile?.demo} compact/>
    </div>
    <CalendarBoard installments={historyInstallments}/>
  </>;
}

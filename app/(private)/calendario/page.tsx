import { getInstallments, getHistoricalInstallments, getCurrentProfile, getPayments } from "@/lib/data";
import { CalendarBoard } from "@/components/calendar/calendar-board";
import { PaymentForm } from "@/components/forms/payment-form";

export default async function P(){
  const [activeInstallments,historyInstallments,profile,payments]=await Promise.all([
    getInstallments(),
    getHistoricalInstallments(),
    getCurrentProfile(),
    getPayments(),
  ]);
  return <>
    <div className="page-head">
      <div>
        <div className="eyebrow">Agenda financeira</div>
        <h1>Calendário financeiro</h1>
        <div className="muted">Recebimentos dos clientes, parcelas pagas e pendências no mesmo calendário.</div>
      </div>
      <div className="page-actions"><PaymentForm installments={activeInstallments} demo={profile?.demo} compact/></div>
    </div>
    <CalendarBoard installments={historyInstallments} interestPayments={payments.filter(p=>p.payment_kind==="JUROS"&&p.installment_id).map(p=>({id:p.id,installment_id:p.installment_id!}))}/>
  </>;
}

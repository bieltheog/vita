import { getCashDebts } from "@/lib/cash-data";
import { getInstallments,getCurrentProfile } from "@/lib/data";
import { CalendarBoard } from "@/components/calendar/calendar-board";
import { PaymentForm } from "@/components/forms/payment-form";

export default async function P(){
  const [i,p,debts]=await Promise.all([getInstallments(),getCurrentProfile(),getCashDebts()]);
  return <><div className="page-head"><div><div className="eyebrow">Agenda financeira</div><h1>Calendário financeiro</h1><div className="muted">Recebimentos dos clientes e suas dívidas no mesmo lugar, com visão do líquido previsto.</div></div><PaymentForm installments={i} demo={p?.demo} compact/></div><CalendarBoard installments={i} debts={debts}/></>
}

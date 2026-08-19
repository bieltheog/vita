import { getCashAccount, getCashDebts, getCashEntries } from "@/lib/cash-data";
import { getInstallments, getLoans, getPayments } from "@/lib/data";
import { brazilDateKey } from "@/lib/date";
import { CashManager, type CashMovement, type CashSummary } from "@/components/cash/cash-manager";

export default async function MeuCaixaPage() {
  const today=brazilDateKey();
  const [account,entries,debts,loans,payments,installments]=await Promise.all([
    getCashAccount(),getCashEntries(),getCashDebts(),getLoans(),getPayments(),getInstallments(),
  ]);

  const trackingStart=account?.tracking_start_date||today;
  const openingBalance=Number(account?.opening_balance||0);
  const reserveAmount=Number(account?.reserve_amount||0);

  const activeManual=entries.filter(e=>!e.voided_at&&e.entry_date>=trackingStart);
  const manualIncome=activeManual.filter(e=>e.entry_type==="ENTRADA").reduce((s,e)=>s+Number(e.amount),0);
  const manualExpenses=activeManual.filter(e=>e.entry_type==="GASTO").reduce((s,e)=>s+Number(e.amount),0);
  const loansSince=loans.filter(l=>l.status!=="CANCELADO"&&l.start_date>=trackingStart);
  const loansGranted=loansSince.reduce((s,l)=>s+Number(l.principal_amount),0);
  const paymentsSince=payments.filter(p=>p.payment_date.slice(0,10)>=trackingStart);
  const paymentsReceived=paymentsSince.reduce((s,p)=>s+Number(p.amount),0);
  const available=openingBalance+manualIncome+paymentsReceived-manualExpenses-loansGranted;
  const lendable=Math.max(0,available-reserveAmount);
  const totalReceivable=installments.filter(i=>i.stored_status!=="CANCELADO").reduce((s,i)=>s+Number(i.remaining_amount),0);
  const pendingDebts=debts.filter(d=>d.status==="PENDENTE");
  const pendingDebtAmount=pendingDebts.reduce((s,d)=>s+Number(d.amount),0);

  const manualMovements:CashMovement[]=entries
    .filter(e=>e.entry_date>=trackingStart)
    .map(e=>({
      id:e.id,
      date:e.entry_date,
      title:e.description||e.category.replaceAll("_"," "),
      description:`${e.entry_type==="ENTRADA"?"Entrada":"Gasto"} · ${e.category.replaceAll("_"," ")}`,
      amount:(e.entry_type==="ENTRADA"?1:-1)*Number(e.amount),
      source:"manual",
      voided:Boolean(e.voided_at),
    }));
  const loanMovements:CashMovement[]=loansSince.map(l=>({
    id:l.id,
    date:l.start_date,
    title:l.client?.name||"Cliente",
    description:`Empréstimo ${l.loan_code}`,
    amount:-Number(l.principal_amount),
    source:"loan",
  }));
  const paymentMovements:CashMovement[]=paymentsSince.map(p=>({
    id:p.id,
    date:p.payment_date.slice(0,10),
    title:p.client?.name||"Cliente",
    description:`Pagamento recebido · ${p.loan?.loan_code||"empréstimo"}`,
    amount:Number(p.amount),
    source:"payment",
  }));
  const movements=[...manualMovements,...loanMovements,...paymentMovements]
    .sort((a,b)=>b.date.localeCompare(a.date));

  const summary:CashSummary={
    openingBalance,
    reserveAmount,
    trackingStartDate:trackingStart,
    available,
    lendable,
    manualIncome,
    paymentsReceived,
    manualExpenses,
    loansGranted,
    totalReceivable,
    pendingDebtAmount,
  };

  return <>
    <div className="page-head"><div><div className="eyebrow">Gestor financeiro</div><h1>Meu Caixa</h1><div className="muted">Seu dinheiro em um só lugar: saldo, entradas, gastos, empréstimos, recebimentos e dívidas.</div></div></div>
    <CashManager summary={summary} movements={movements} debts={debts} configured={Boolean(account)} today={today}/>
  </>;
}

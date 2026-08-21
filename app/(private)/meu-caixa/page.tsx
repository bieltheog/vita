import { addDays, format } from "date-fns";
import { getCashAccount, getCashDebts, getCashEntries, getLoanTopups } from "@/lib/cash-data";
import { getInstallments, getLoans, getPayments } from "@/lib/data";
import { brazilDateKey } from "@/lib/date";
import {
  CashManager, type CashForecast, type CashForecastDay,
  type CashMovement, type CashSummary,
} from "@/components/cash/cash-manager";

export default async function MeuCaixaPage() {
  const today=brazilDateKey();
  const horizon=format(addDays(new Date(`${today}T12:00:00`),30),"yyyy-MM-dd");
  const [account,entries,debts,loans,payments,installments,topups]=await Promise.all([
    getCashAccount(),getCashEntries(),getCashDebts(),getLoans(),getPayments(),getInstallments(),getLoanTopups(),
  ]);

  const trackingStart=account?.tracking_start_date||today;
  const openingBalance=Number(account?.opening_balance||0);
  const reserveAmount=Number(account?.reserve_amount||0);

  const activeManual=entries.filter(e=>!e.voided_at&&e.entry_date>=trackingStart&&e.entry_date<=today);
  const futureManual=entries.filter(e=>!e.voided_at&&e.entry_date>today&&e.entry_date<=horizon);
  const manualIncome=activeManual.filter(e=>e.entry_type==="ENTRADA").reduce((s,e)=>s+Number(e.amount),0);
  const manualExpenses=activeManual.filter(e=>e.entry_type==="GASTO").reduce((s,e)=>s+Number(e.amount),0);

  // O principal atual do empréstimo inclui os adicionais. Para o caixa, separamos
  // o valor original (na data inicial) de cada adicional (na data em que realmente saiu).
  const topupByLoan=new Map<string,number>();
  topups.forEach(t=>topupByLoan.set(t.loan_id,(topupByLoan.get(t.loan_id)||0)+Number(t.amount)));
  const basePrincipal=(loanId:string,currentPrincipal:number)=>Math.max(0,Number(currentPrincipal)-(topupByLoan.get(loanId)||0));

  const loansSince=loans.filter(l=>l.status!=="CANCELADO"&&l.start_date>=trackingStart&&l.start_date<=today);
  const futureLoans=loans.filter(l=>l.status!=="CANCELADO"&&l.start_date>today&&l.start_date<=horizon);
  const topupsSince=topups.filter(t=>t.topup_date>=trackingStart&&t.topup_date<=today);
  const loansGrantedBase=loansSince.reduce((s,l)=>s+basePrincipal(l.id,Number(l.principal_amount)),0);
  const topupsGranted=topupsSince.reduce((s,t)=>s+Number(t.amount),0);
  const loansGranted=loansGrantedBase+topupsGranted;

  const paymentsSince=payments.filter(p=>{
    const date=p.payment_date.slice(0,10);
    return date>=trackingStart&&date<=today;
  });
  const paymentsReceived=paymentsSince.reduce((s,p)=>s+Number(p.amount),0);

  const available=openingBalance+manualIncome+paymentsReceived-manualExpenses-loansGranted;
  const lendable=Math.max(0,available-reserveAmount);
  const totalReceivable=installments.filter(i=>i.stored_status!=="CANCELADO").reduce((s,i)=>s+Number(i.remaining_amount),0);
  const pendingDebts=debts.filter(d=>d.status==="PENDENTE");
  const pendingDebtAmount=pendingDebts.reduce((s,d)=>s+Number(d.amount),0);

  const manualMovements:CashMovement[]=entries
    .filter(e=>e.entry_date>=trackingStart&&e.entry_date<=today)
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
    description:`Empréstimo ${l.loan_code} · valor original`,
    amount:-basePrincipal(l.id,Number(l.principal_amount)),
    source:"loan",
  })).filter(m=>Math.abs(m.amount)>0.001);
  const topupMovements:CashMovement[]=topupsSince.map(t=>({
    id:t.id,
    date:t.topup_date,
    title:t.client?.name||"Cliente",
    description:`Adicional no empréstimo ${t.loan?.loan_code||""}`,
    amount:-Number(t.amount),
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
  const movements=[...manualMovements,...loanMovements,...topupMovements,...paymentMovements]
    .sort((a,b)=>b.date.localeCompare(a.date));

  const installments30=installments.filter(i=>
    i.stored_status!=="CANCELADO"&&Number(i.remaining_amount)>0&&i.due_date>=today&&i.due_date<=horizon
  );
  const debts30=pendingDebts.filter(d=>d.due_date<=horizon);
  const receivable30=installments30.reduce((s,i)=>s+Number(i.remaining_amount),0);
  const debt30=debts30.reduce((s,d)=>s+Number(d.amount),0);
  const futureManualIncome=futureManual.filter(e=>e.entry_type==="ENTRADA").reduce((s,e)=>s+Number(e.amount),0);
  const futureManualOut=futureManual.filter(e=>e.entry_type==="GASTO").reduce((s,e)=>s+Number(e.amount),0);
  const futureLoanOut=futureLoans.reduce((s,l)=>s+basePrincipal(l.id,Number(l.principal_amount)),0);
  const projectedBalance=available+receivable30+futureManualIncome-debt30-futureManualOut-futureLoanOut;
  const safeLend=Math.max(0,available-reserveAmount-debt30);

  type DraftDay=Omit<CashForecastDay,"balance">;
  const eventMap=new Map<string,DraftDay>();
  const event=(date:string)=>{
    const key=date<today?today:date;
    const current=eventMap.get(key)||{date:key,income:0,outflow:0,receivable:0,debts:0,otherIncome:0,otherOutflow:0};
    eventMap.set(key,current);
    return current;
  };

  installments30.forEach(i=>{const row=event(i.due_date);const value=Number(i.remaining_amount);row.income+=value;row.receivable+=value;});
  debts30.forEach(d=>{const row=event(d.due_date);const value=Number(d.amount);row.outflow+=value;row.debts+=value;});
  futureManual.forEach(e=>{const row=event(e.entry_date);const value=Number(e.amount);if(e.entry_type==="ENTRADA"){row.income+=value;row.otherIncome+=value;}else{row.outflow+=value;row.otherOutflow+=value;}});
  futureLoans.forEach(l=>{const row=event(l.start_date);const value=basePrincipal(l.id,Number(l.principal_amount));row.outflow+=value;row.otherOutflow+=value;});

  let running=available;
  const forecastDays:CashForecastDay[]=[...eventMap.values()]
    .sort((a,b)=>a.date.localeCompare(b.date))
    .map(day=>{running+=day.income-day.outflow;return {...day,balance:running};});

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

  const forecast:CashForecast={
    horizonDate:horizon,
    projectedBalance,
    safeLend,
    receivable:receivable30,
    debts:debt30,
    otherIncome:futureManualIncome,
    otherOutflow:futureManualOut+futureLoanOut,
    days:forecastDays,
  };

  return <>
    <div className="page-head"><div><div className="eyebrow">Gestor financeiro</div><h1>Meu Caixa</h1><div className="muted">Saldo real de hoje, compromissos e uma visão clara de como o caixa pode evoluir.</div></div></div>
    <CashManager summary={summary} forecast={forecast} movements={movements} debts={debts} configured={Boolean(account)} today={today}/>
  </>;
}

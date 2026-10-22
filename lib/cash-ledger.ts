import type { Loan, LoanTopup, Payment } from "@/lib/types";

export type CashEntryKind =
  | "APORTE" | "CREDITO" | "AMORTIZACAO_DIVIDA" | "JUROS_FINANCIAMENTO"
  | "RETIRADA" | "DESPESA" | "PERDA" | "RECUPERACAO" | "OUTRA_ENTRADA" | "OUTRA_SAIDA";

export interface PortfolioCashEntry {
  id:string;
  portfolio_id:1|2;
  kind:CashEntryKind;
  amount:number;
  entry_date:string;
  description:string;
  loan_id:string|null;
  created_at:string;
  voided_at:string|null;
}
export interface CashBaseline {
  portfolio_id:1|2;
  start_date:string;
  opening_balance:number;
  created_at:string;
}
export interface CashMovement {
  id:string;
  date:string;
  createdAt:string;
  description:string;
  category:string;
  source:"loan"|"topup"|"payment"|"manual";
  direction:"ENTRADA"|"SAIDA";
  amount:number;
  delta:number;
  balanceBefore:number;
  balanceAfter:number;
  entryId?:string;
}
const cents=(value:number)=>Math.round(Number(value||0)*100);
const amount=(centavos:number)=>centavos/100;

/**
 * O caixa é fluxo de dinheiro, não receita contratada.
 * Pagamentos estornados são ignorados mesmo se chegarem ao array por engano.
 * "PERDA" e "RECUPERACAO" são contábeis e não movimentam caixa.
 * A data do corte representa o SALDO DO INÍCIO DO DIA.
 */
export function buildCashLedger({
  loans,payments,topups,entries,baseline
}:{
  loans:Loan[];
  payments:Payment[];
  topups:LoanTopup[];
  entries:PortfolioCashEntry[];
  baseline:CashBaseline|null;
}) {
  const extras=new Map<string,number>();
  for(const topup of topups) extras.set(topup.loan_id,(extras.get(topup.loan_id)||0)+cents(topup.amount));
  type Raw=Omit<CashMovement,"balanceBefore"|"balanceAfter">;
  const raw:Raw[]=[];
  const outgoing=(item:Omit<Raw,"direction"|"delta"|"amount">,value:number)=>{
    const v=Math.max(0,Math.round(value));
    if(v>0)raw.push({...item,direction:"SAIDA",amount:amount(v),delta:-amount(v)});
  };
  const incoming=(item:Omit<Raw,"direction"|"delta"|"amount">,value:number)=>{
    const v=Math.max(0,Math.round(value));
    if(v>0)raw.push({...item,direction:"ENTRADA",amount:amount(v),delta:amount(v)});
  };
  for(const loan of loans){
    const initial=cents(loan.principal_amount)-(extras.get(loan.id)||0);
    outgoing({
      id:"loan:"+loan.id,date:loan.start_date,createdAt:loan.created_at,
      category:"Empréstimo concedido",source:"loan",
      description:`${loan.loan_code} · ${loan.client?.name||"Cliente"}`
    },initial);
  }
  for(const topup of topups) outgoing({
    id:"topup:"+topup.id,date:topup.topup_date,createdAt:topup.created_at,
    category:"Capital adicional",source:"topup",
    description:`Adicional · ${topup.loan?.loan_code||"Empréstimo"}`
  },cents(topup.amount));
  for(const p of payments){
    if(p.voided_at)continue;
    incoming({
      id:"payment:"+p.id,date:p.payment_date,createdAt:p.created_at,
      category:p.payment_kind==="JUROS"?"Juros recebidos":"Pagamento de cliente",
      source:"payment",description:`${p.client?.name||"Cliente"} · ${p.loan?.loan_code||"Empréstimo"}`
    },cents(p.amount));
  }

  const labels:Record<CashEntryKind,string>={
    APORTE:"Aporte dos sócios", CREDITO:"Empréstimo recebido",
    AMORTIZACAO_DIVIDA:"Pagamento de dívida (principal)",
    JUROS_FINANCIAMENTO:"Juros de dívida/financiamento",
    RETIRADA:"Retirada dos sócios", DESPESA:"Despesa",
    PERDA:"Prejuízo reconhecido (sem caixa)", RECUPERACAO:"Reversão de prejuízo (sem caixa)",
    OUTRA_ENTRADA:"Outra entrada",OUTRA_SAIDA:"Outra saída"
  };
  for(const e of entries){
    if(e.voided_at || e.kind==="PERDA" || e.kind==="RECUPERACAO")continue;
    const item={
      id:"entry:"+e.id,entryId:e.id,date:e.entry_date,createdAt:e.created_at,
      category:labels[e.kind],description:e.description,source:"manual" as const
    };
    if(["APORTE","CREDITO","OUTRA_ENTRADA"].includes(e.kind)) incoming(item,cents(e.amount));
    else outgoing(item,cents(e.amount));
  }
  const effective=raw.filter(e=>!baseline || e.date>=baseline.start_date).sort((a,b)=>
    a.date.localeCompare(b.date) ||
    a.createdAt.localeCompare(b.createdAt) ||
    a.id.localeCompare(b.id));
  let balance=cents(baseline?.opening_balance||0);
  let inflow=0,outflow=0;
  const movements:CashMovement[]=effective.map(row=>{
    const before=balance;
    const delta=cents(row.delta);
    balance+=delta;
    if(delta>=0)inflow+=delta;else outflow-=delta;
    return {...row,balanceBefore:amount(before),balanceAfter:amount(balance)};
  });
  return {
    openingBalance:amount(cents(baseline?.opening_balance||0)),
    balance:amount(balance),
    received:amount(inflow),
    spent:amount(outflow),
    movements:movements.reverse(),
    reconciled:Boolean(baseline),
    startDate:baseline?.start_date||null
  };
}

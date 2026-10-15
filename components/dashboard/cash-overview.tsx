import Link from "next/link";
import { getActivePortfolio } from "@/lib/portfolio";
import { getLoans,getPayments,getLoanTopups } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { buildCashLedger } from "@/lib/cash-ledger";
import type { CashBaseline,PortfolioCashEntry } from "@/lib/cash-ledger";
import { money } from "@/lib/finance";

export async function CashOverview(){
  const [portfolioId,loans,payments,topups,supabase]=await Promise.all([
    getActivePortfolio(),getLoans(),getPayments(),getLoanTopups(),createClient()
  ]);
  const [entriesRes,baseRes]=supabase?await Promise.all([
    supabase.from("portfolio_entries").select("*").eq("portfolio_id",portfolioId),
    supabase.from("portfolio_cash_baselines").select("*").eq("portfolio_id",portfolioId).maybeSingle()
  ]):[{data:[],error:null},{data:null,error:null}];
  if(entriesRes.error)throw entriesRes.error;
  if(baseRes.error)throw baseRes.error;
  const cash=buildCashLedger({
    loans,payments,topups,entries:(entriesRes.data||[]) as PortfolioCashEntry[],
    baseline:baseRes.data as CashBaseline|null
  });
  return <Link href="/carteiras" className="card" style={{textDecoration:"none",color:"inherit"}}>
    <div className="muted">Dinheiro disponível · Carteira {portfolioId}</div>
    <div className="stat-value" style={{color:cash.balance<0?"var(--red)":"var(--green)"}}>
      {portfolioId===1&&!cash.reconciled?"Não conciliado":money(cash.balance)}
    </div>
    <div className="stat-meta">
      {portfolioId===1&&!cash.reconciled
        ?"Defina o saldo de abertura para acompanhar cada real."
        :"Entradas e saídas reais. Clique para ver o extrato."}
    </div>
  </Link>;
}

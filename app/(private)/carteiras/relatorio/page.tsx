import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { getDashboardSummary, getLoans, getPayments, getLoanTopups } from "@/lib/data";
import { getActivePortfolio } from "@/lib/portfolio";
import { createClient } from "@/lib/supabase/server";
import { brazilDateKey, brazilDateTime } from "@/lib/date";
import { money, realizedProfitForPayment, roundMoney } from "@/lib/finance";
import { buildCashLedger } from "@/lib/cash-ledger";
import type { CashBaseline, PortfolioCashEntry, CashMovement } from "@/lib/cash-ledger";
import { CashReportActions } from "@/components/reports/cash-report-actions";
import "./report.css";

function dateOrDefault(value: string | string[] | undefined, fallback: string) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const date = new Date(value + "T12:00:00Z");
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? fallback : value;
}

const displayDate = (value: string) => value.split("-").reverse().join("/");

export default async function CashReportPage({
  searchParams
}: {
  searchParams: Promise<{ inicio?: string | string[]; fim?: string | string[] }>;
}) {
  const query = await searchParams;
  const today = brazilDateKey();
  const selectedFrom = dateOrDefault(query.inicio, today);
  const selectedTo = dateOrDefault(query.fim, today);
  const swapped = selectedFrom > selectedTo;
  const from = swapped ? selectedTo : selectedFrom;
  const to = swapped ? selectedFrom : selectedTo;

  // As funções de dados já respeitam a carteira selecionada e as políticas RLS.
  const [portfolioId, loans, payments, topups, summary, supabase] = await Promise.all([
    getActivePortfolio(), getLoans(), getPayments(), getLoanTopups(),
    getDashboardSummary(), createClient()
  ]);
  let entries: PortfolioCashEntry[] = [];
  let baseline: CashBaseline | null = null;
  if (supabase) {
    const [events, opening] = await Promise.all([
      supabase.from("portfolio_entries").select("*").eq("portfolio_id", portfolioId),
      supabase.from("portfolio_cash_baselines").select("*").eq("portfolio_id", portfolioId).maybeSingle()
    ]);
    if (events.error) throw events.error;
    if (opening.error) throw opening.error;
    entries = (events.data || []) as PortfolioCashEntry[];
    baseline = opening.data as CashBaseline | null;
  }

  const ledger = buildCashLedger({ loans, payments, topups, entries, baseline });
  const reconciled = portfolioId === 2 || Boolean(baseline);
  const periodIsBeforeOpening = Boolean(baseline && to < baseline.start_date);
  const fromBeforeOpening = Boolean(baseline && from < baseline.start_date);
  const periodMovements = ledger.movements.filter(row => row.date >= from && row.date <= to);
  const sumRows = (predicate: (row: CashMovement) => boolean) =>
    roundMoney(periodMovements.filter(predicate).reduce((total, row) => total + row.amount, 0));
  const received = sumRows(row => row.direction === "ENTRADA");
  const spent = sumRows(row => row.direction === "SAIDA");
  const openingBalance = roundMoney(ledger.openingBalance +
    ledger.movements.filter(row => row.date < from).reduce((total, row) => total + row.delta, 0));
  const closingBalance = roundMoney(openingBalance + received - spent);
  const balanceKnown = reconciled && !fromBeforeOpening && !periodIsBeforeOpening;

  const clientReceipts = sumRows(row => row.source === "payment");
  const disbursed = sumRows(row => row.source === "loan" || row.source === "topup");
  const effectiveFrom = baseline && from < baseline.start_date ? baseline.start_date : from;
  const periodPayments = payments.filter(p => p.payment_date >= effectiveFrom && p.payment_date <= to);
  const loanMap = new Map(loans.map(l => [l.id, l]));
  const estimatedInterest = roundMoney(periodPayments.reduce((total, payment) =>
    total + realizedProfitForPayment(payment, loanMap.get(payment.loan_id)), 0));
  const principalReturned = roundMoney(clientReceipts - estimatedInterest);
  const otherReceived = roundMoney(received - clientReceipts);
  const otherSpent = roundMoney(spent - disbursed);

  return <div className="cash-report-shell">
    <div className="cash-report-toolbar cash-report-screen-only">
      <div>
        <Link href="/carteiras" className="cash-inline-link"><ArrowLeft size={16}/> Voltar ao caixa</Link>
        <h1 style={{marginTop:10,marginBottom:4}}>Relatório diário</h1>
        <p className="muted" style={{margin:0}}>Resumo simples do dinheiro, dos recebimentos e dos atrasos.</p>
      </div>
      <form className="cash-report-period" action="/carteiras/relatorio" method="get">
        <div className="field"><label htmlFor="report-from">De</label>
          <input className="input" type="date" id="report-from" name="inicio" defaultValue={from} required/></div>
        <div className="field"><label htmlFor="report-to">Até</label>
          <input className="input" type="date" id="report-to" name="fim" defaultValue={to} required/></div>
        <button type="submit" className="btn secondary"><FileText size={16}/> Consultar</button>
      </form>
      <CashReportActions portfolioId={portfolioId} start={from} end={to} reconciled={balanceKnown} rows={periodMovements.map(row=>({
        date:row.date,category:row.category,description:row.description,
        direction:row.direction,amount:row.amount,balanceAfter:row.balanceAfter
      }))}/>
    </div>
    {swapped && <p className="cash-report-warning cash-report-screen-only">As datas foram colocadas em ordem cronológica.</p>}

    <article className="cash-report-paper">
      <header className="cash-report-header">
        <div>
          <h1>Resumo financeiro</h1>
          <p className="cash-report-sub">Carteira {portfolioId} · {displayDate(from)}{from!==to?" a "+displayDate(to):""}</p>
          <p className="cash-report-sub">Gerado em {brazilDateTime()}</p>
        </div>
        <span className="cash-report-mark">JUREMINHA</span>
      </header>

      <section className="cash-simple-main">
        <div className="cash-simple-balance">
          <span>Dinheiro disponível no fim do período</span>
          <strong>{balanceKnown?money(closingBalance):"Não conciliado"}</strong>
        </div>
        <h2>1. Quanto entrou e saiu?</h2>
        <div className="cash-simple-line"><span>Saldo no início</span><strong>{balanceKnown?money(openingBalance):"Não conciliado"}</strong></div>
        <div className="cash-simple-line positive"><span>+ Recebido de clientes</span><strong>{money(clientReceipts)}</strong></div>
        {otherReceived!==0 && <div className="cash-simple-line"><span>+ Aportes, créditos e outras entradas</span><strong>{money(otherReceived)}</strong></div>}
        <div className="cash-simple-line negative"><span>− Novos empréstimos liberados</span><strong>{money(disbursed)}</strong></div>
        <div className="cash-simple-line negative"><span>− Gastos, dívidas e outras saídas</span><strong>{money(otherSpent)}</strong></div>
        <div className="cash-simple-line final"><span>= Saldo calculado</span><strong>{balanceKnown?money(closingBalance):"Não conciliado"}</strong></div>
      </section>

      <section className="cash-simple-result">
        <h2>2. O que voltou dos clientes?</h2>
        <p className="cash-simple-explain">Os valores abaixo já estão dentro de “Recebido de clientes”. Não devem ser somados novamente ao saldo.</p>
        <div className="cash-simple-cards">
          <div className="cash-simple-card"><span>Capital recuperado</span><strong>{money(principalReturned)}</strong><small>Principal devolvido · estimado</small></div>
          <div className="cash-simple-card"><span>Juros recebidos</span><strong>{money(estimatedInterest)}</strong><small>Receita bruta · estimada</small></div>
        </div>
      </section>

      <section className="cash-simple-result">
        <h2>3. Quanto está atrasado?</h2>
        <div className="cash-simple-cards">
          <div className="cash-simple-card cash-simple-alert"><span>Inadimplência total da carteira</span><strong>{money(summary.overdue)}</strong><small>Parcelas vencidas em aberto até {displayDate(today)}</small></div>
          <div className="cash-simple-card"><span>Capital atualmente na rua</span><strong>{money(summary.capitalCirculation)}</strong><small>Posição atual · não é saldo do dia</small></div>
        </div>
      </section>

      <div className="cash-simple-note">
        <strong>Atenção:</strong> capital recuperado e juros podem ser estimados em contratos antigos. Inadimplência não é perda definitiva.
        O saldo só fica conferido após comparar com o dinheiro no banco e em espécie.
        {portfolioId===1&&!baseline?" A Carteira 1 ainda não possui saldo inicial conciliado.":""}
        {fromBeforeOpening?" O período começa antes da abertura do caixa em "+displayDate(baseline!.start_date)+". Os movimentos anteriores não entram no cálculo.":""}
        {periodIsBeforeOpening?" O período termina antes da abertura do caixa.":""}
      </div>
      <footer className="cash-report-footer">
        Relatório interno · Os valores se referem à Carteira {portfolioId}.
        Para conferir cada movimentação, utilize o CSV do extrato.
      </footer>
    </article>

    <details className="cash-report-extract cash-report-screen-only">
      <summary>Ver movimentações do período ({periodMovements.length})</summary>
      <div className="cash-report-paper">
        <h2>Extrato detalhado</h2>
        <p className="cash-report-sub">As entradas e saídas abaixo já fazem parte do resumo financeiro.</p>
        {periodMovements.length===0
          ?<p className="cash-report-empty">Nenhuma movimentação registrada no período.</p>
          :<div style={{overflowX:"auto"}}><table className="cash-report-table">
            <thead><tr><th>Data</th><th>Categoria</th><th>Descrição</th><th>Entrada</th><th>Saída</th><th>Saldo após</th></tr></thead>
            <tbody>{periodMovements.map(row=><tr key={row.id}>
              <td>{displayDate(row.date)}</td><td>{row.category}</td><td>{row.description}</td>
              <td className="num">{row.direction==="ENTRADA"?money(row.amount):"·"}</td>
              <td className="num">{row.direction==="SAIDA"?money(row.amount):"·"}</td>
              <td className="num">{balanceKnown?money(row.balanceAfter):"Não conciliado"}</td>
            </tr>)}</tbody>
          </table></div>}
      </div>
    </details>
  </div>;
}

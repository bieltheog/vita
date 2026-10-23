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

function Kpi({ label, value }: { label: string; value: string }) {
  return <div className="cash-report-kpi"><span>{label}</span><strong>{value}</strong></div>;
}

function DetailTable({ title, rows }: { title: string; rows: [string, number][] }) {
  return <section>
    <h2>{title}</h2>
    <table className="cash-report-table">
      <thead><tr><th>Descrição</th><th>Valor</th></tr></thead>
      <tbody>{rows.map(([name, value]) =>
        <tr key={name}><td>{name}</td><td className="num">{money(value)}</td></tr>
      )}</tbody>
    </table>
  </section>;
}

export default async function CashReportPage({
  searchParams
}: {
  searchParams: Promise<{ inicio?: string | string[]; fim?: string | string[] }>;
}) {
  const query = await searchParams;
  const today = brazilDateKey();
  const selectedFrom = dateOrDefault(query.inicio, today.slice(0, 7) + "-01");
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
  const capitalIn = sumRows(row => row.category === "Aporte dos sócios");
  const creditIn = sumRows(row => row.category === "Empréstimo recebido");
  const otherIn = roundMoney(received - clientReceipts - capitalIn - creditIn);
  const debtPrincipalOut = sumRows(row => row.category === "Pagamento de dívida (principal)");
  const fundingCosts = sumRows(row => row.category === "Juros de dívida/financiamento");
  const operationalCosts = sumRows(row => row.category === "Despesa");
  const withdrawals = sumRows(row => row.category === "Retirada dos sócios");
  const otherOut = roundMoney(spent - disbursed - debtPrincipalOut - fundingCosts - operationalCosts - withdrawals);

  const effectiveFrom = baseline && from < baseline.start_date ? baseline.start_date : from;
  const periodPayments = payments.filter(p => p.payment_date >= effectiveFrom && p.payment_date <= to);
  const loanMap = new Map(loans.map(l => [l.id, l]));
  const estimatedInterest = roundMoney(periodPayments.reduce((total, payment) =>
    total + realizedProfitForPayment(payment, loanMap.get(payment.loan_id)), 0));
  const principalReturned = roundMoney(clientReceipts - estimatedInterest);
  const validEntries = entries.filter(e => !e.voided_at && e.entry_date >= effectiveFrom && e.entry_date <= to);
  const lost = roundMoney(validEntries.filter(e => e.kind === "PERDA").reduce((sum, e) => sum + Number(e.amount), 0));
  const recovered = roundMoney(validEntries.filter(e => e.kind === "RECUPERACAO").reduce((sum, e) => sum + Number(e.amount), 0));
  const estimatedResult = roundMoney(estimatedInterest - fundingCosts - operationalCosts - lost + recovered);

  return <div className="cash-report-shell">
    <div className="cash-report-toolbar cash-report-screen-only">
      <div>
        <Link href="/carteiras" className="cash-inline-link"><ArrowLeft size={16} /> Voltar ao caixa</Link>
        <h1 style={{marginTop:10,marginBottom:4}}>Gerar relatório</h1>
        <p className="muted" style={{margin:0}}>Selecione o período, confira os valores e salve em PDF ou CSV.</p>
      </div>
      <form className="cash-report-period" action="/carteiras/relatorio" method="get">
        <div className="field"><label htmlFor="report-from">Data inicial</label>
          <input className="input" type="date" id="report-from" name="inicio" defaultValue={from} required /></div>
        <div className="field"><label htmlFor="report-to">Data final</label>
          <input className="input" type="date" id="report-to" name="fim" defaultValue={to} required /></div>
        <button type="submit" className="btn secondary"><FileText size={16} /> Atualizar</button>
      </form>
      <CashReportActions portfolioId={portfolioId} start={from} end={to} reconciled={balanceKnown} rows={periodMovements.map(row => ({
        date: row.date, category: row.category, description: row.description,
        direction: row.direction, amount: row.amount, balanceAfter: row.balanceAfter
      }))} />
    </div>
    {swapped && <p className="cash-report-warning cash-report-screen-only">As datas foram colocadas em ordem cronológica.</p>}

    <article className="cash-report-paper">
      <header className="cash-report-header">
        <div><h1>Relatório financeiro</h1>
          <p className="cash-report-sub">Jureminha · Carteira {portfolioId}</p>
          <p className="cash-report-sub">Período: {displayDate(from)} a {displayDate(to)}</p>
          <p className="cash-report-sub">Gerado em: {brazilDateTime()}</p>
        </div>
        <span className="cash-report-mark">JUREMINHA</span>
      </header>

      <div className="cash-report-kpis">
        <Kpi label="Saldo inicial do período" value={balanceKnown ? money(openingBalance) : "Não conciliado"} />
        <Kpi label="Entradas em caixa" value={money(received)} />
        <Kpi label="Saídas de caixa" value={money(spent)} />
        <Kpi label="Saldo ao final do período" value={balanceKnown ? money(closingBalance) : "Não conciliado"} />
        <Kpi label="Capital recuperado no período (estimado)" value={money(principalReturned)} />
        <Kpi label="Juros recebidos (estimativa)" value={money(estimatedInterest)} />
        <Kpi label="Resultado operacional estimado" value={money(estimatedResult)} />
        <Kpi label={`Inadimplência total hoje (${displayDate(today)})`} value={money(summary.overdue)} />
      </div>

      <div className="cash-report-note">
        <strong>Critério:</strong> o extrato usa apenas dinheiro efetivamente lançado.
        Devolução de principal não é lucro; empréstimos liberados não são despesas operacionais.
        A estimativa de juros usa a divisão cadastrada por pagamento ou o rateio histórico do contrato.
        Capital recuperado corresponde à parcela do principal já devolvida, separada dos juros.
        A inadimplência total é o saldo de todas as parcelas vencidas e ainda não pagas da carteira na data de geração, inclusive atrasos anteriores ao período selecionado; não significa perda definitiva.
        Perdas reconhecidas e recuperações afetam o resultado estimado, mas não movimentam o caixa.
      </div>
      {!reconciled && <div className="cash-report-note"><strong>Atenção:</strong> a Carteira 1 ainda não possui saldo inicial conciliado. Entradas, saídas e movimentações são exibidas, mas o saldo não é certificado.</div>}
      {fromBeforeOpening && <div className="cash-report-note"><strong>Corte financeiro:</strong> o caixa desta carteira só considera movimentações desde {displayDate(baseline!.start_date)}. Registros anteriores à abertura não estão incluídos nos totais deste relatório.</div>}
      {periodIsBeforeOpening && <div className="cash-report-note">O período selecionado termina antes da abertura do controle de caixa. Não há saldo conciliável para essa janela.</div>}
      {portfolioId === 2 && !baseline && <div className="cash-report-note">A Carteira 2 parte de saldo zero. O saldo calculado depende de todos os aportes, financiamentos e despesas reais terem sido cadastrados.</div>}

      <div className="cash-report-twocol">
        <DetailTable title="Entradas do período" rows={[
          ["Pagamentos de clientes", clientReceipts],
          ["Aporte de capital", capitalIn],
          ["Créditos/financiamentos recebidos", creditIn],
          ["Outras entradas", otherIn],
          ["TOTAL DE ENTRADAS", received]
        ]} />
        <DetailTable title="Saídas do período" rows={[
          ["Empréstimos e adicionais liberados", disbursed],
          ["Pagamento do principal de dívidas", debtPrincipalOut],
          ["Juros de financiamentos", fundingCosts],
          ["Despesas operacionais", operationalCosts],
          ["Retiradas dos sócios", withdrawals],
          ["Outras saídas", otherOut],
          ["TOTAL DE SAÍDAS", spent]
        ]} />
      </div>

      <h2>Detalhamento dos recebimentos e resultado</h2>
      <table className="cash-report-table">
        <tbody>
          <tr><td>Total recebido de clientes no período</td><td className="num">{money(clientReceipts)}</td></tr>
          <tr><td>Principal recuperado (estimado)</td><td className="num">{money(principalReturned)}</td></tr>
          <tr><td>Juros recebidos (estimados)</td><td className="num">{money(estimatedInterest)}</td></tr>
          <tr><td>Perdas de capital reconhecidas, sem efeito no caixa</td><td className="num">{money(lost)}</td></tr>
          <tr><td>Recuperação de perdas, sem efeito no caixa</td><td className="num">{money(recovered)}</td></tr>
          <tr><td><strong>Resultado operacional estimado</strong></td><td className="num"><strong>{money(estimatedResult)}</strong></td></tr>
        </tbody>
      </table>

      <h2>Posição atual da carteira (não representa a data histórica do período)</h2>
      <table className="cash-report-table">
        <tbody>
          <tr><td>Capital em circulação atualmente</td><td className="num">{money(summary.capitalCirculation)}</td></tr>
          <tr><td>Inadimplência total em aberto hoje ({displayDate(today)})</td><td className="num">{money(summary.overdue)}</td></tr>
        </tbody>
      </table>

      <h2>Extrato detalhado ({periodMovements.length} movimentações)</h2>
      {periodMovements.length === 0
        ? <p className="cash-report-empty">Nenhuma movimentação de caixa registrada neste período.</p>
        : <table className="cash-report-table">
          <thead><tr><th>Data</th><th>Categoria</th><th>Descrição</th><th>Entrada</th><th>Saída</th><th>Saldo após</th></tr></thead>
          <tbody>{periodMovements.map(row => <tr key={row.id}>
            <td>{displayDate(row.date)}</td>
            <td>{row.category}</td>
            <td>{row.description}</td>
            <td className="num">{row.direction === "ENTRADA" ? money(row.amount) : ""}</td>
            <td className="num">{row.direction === "SAIDA" ? money(row.amount) : ""}</td>
            <td className="num">{balanceKnown ? money(row.balanceAfter) : "Não conciliado"}</td>
          </tr>)}</tbody>
        </table>}
      <footer className="cash-report-footer">Relatório interno de gestão · Valores sujeitos à conferência com extrato bancário e dinheiro em espécie · Carteira {portfolioId}</footer>
    </article>
  </div>;
}

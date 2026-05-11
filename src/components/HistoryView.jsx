import { useMemo, useState } from "react";
import { money, formatDateBR } from "../utils/helpers";
import { getClientMetrics, getClientRisk } from "../utils/calculations";

function FilterButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
        active
          ? "bg-orange-500 text-white"
          : "border border-white/[0.08] bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function SummaryCard({ label, value, tone = "orange" }) {
  const tones = {
    orange: "border-orange-500/20 bg-orange-500/10 text-orange-300",
    green: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    slate: "border-white/[0.08] bg-white/[0.03] text-white",
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] || tones.orange}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-bold">{value}</p>
    </div>
  );
}

function HistoryCard({ record, onOpenProfile }) {
  const metrics = getClientMetrics(record);
  const risk = getClientRisk(record);
  const loans = Array.isArray(record.historicoEmprestimos)
    ? record.historicoEmprestimos
    : [];

  const lastLoan = loans.at(-1);
  const lastDate = lastLoan?.finalizadoEm
    ? new Date(lastLoan.finalizadoEm).toLocaleDateString("pt-BR")
    : record.createdAt
    ? formatDateBR(String(record.createdAt).slice(0, 10))
    : "Sem data";

  return (
    <button
      type="button"
      onClick={() => onOpenProfile?.(record)}
      className="group rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-left transition hover:border-orange-500/30 hover:bg-white/[0.055]"
    >
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-base font-bold text-white">
              {String(record.nome || "C").charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0">
              <h4 className="truncate text-lg font-bold text-white">
                {record.nome || "Cliente sem nome"}
              </h4>

              <p className="mt-1 truncate text-sm text-slate-500">
                {metrics.totalLoans || 0} empréstimo(s) · último registro {lastDate}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
              Histórico
            </span>

            <span
              className={`rounded-full border px-3 py-1 text-xs font-bold ${risk.className}`}
            >
              {risk.label}
            </span>

            <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-400">
              {record.status || "Ativo"}
            </span>
          </div>
        </div>

        <div className="text-left md:text-right">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
            Lucro total
          </p>

          <p className="mt-1 text-lg font-bold text-emerald-300">
            {money.format(metrics.totalProfit || metrics.totalLucro || 0)}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-white/[0.06] bg-[#0d1016] p-3">
          <p className="text-xs text-slate-500">Total enviado</p>
          <p className="mt-1 font-bold text-white">
            {money.format(metrics.totalSent || metrics.totalEnviado || 0)}
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-[#0d1016] p-3">
          <p className="text-xs text-slate-500">Total esperado</p>
          <p className="mt-1 font-bold text-white">
            {money.format(metrics.totalExpected || metrics.totalAReceber || 0)}
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-[#0d1016] p-3">
          <p className="text-xs text-slate-500">Quitados</p>
          <p className="mt-1 font-bold text-emerald-300">
            {record.status === "Quitado" ? "Sim" : "Parcial"}
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-[#0d1016] p-3">
          <p className="text-xs text-slate-500">Histórico salvo</p>
          <p className="mt-1 font-bold text-white">{loans.length}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end border-t border-white/[0.06] pt-4">
        <span className="text-sm font-bold text-orange-300 transition group-hover:text-orange-200">
          Abrir ficha →
        </span>
      </div>
    </button>
  );
}

export default function HistoryView({ records = [], onOpenProfile }) {
  const [filter, setFilter] = useState("todos");

  const safeRecords = Array.isArray(records) ? records : [];

  const historyRecords = useMemo(() => {
    return safeRecords.filter((record) => {
      const hasHistory =
        Array.isArray(record.historicoEmprestimos) &&
        record.historicoEmprestimos.length > 0;

      return hasHistory || record.status === "Quitado";
    });
  }, [safeRecords]);

  const summary = useMemo(() => {
    const totalLoans = historyRecords.reduce((sum, record) => {
      const loans = Array.isArray(record.historicoEmprestimos)
        ? record.historicoEmprestimos.length
        : 0;

      return sum + loans + (record.status === "Quitado" ? 1 : 0);
    }, 0);

    const totalSent = historyRecords.reduce((sum, record) => {
      const metrics = getClientMetrics(record);
      return sum + Number(metrics.totalSent || metrics.totalEnviado || 0);
    }, 0);

    const totalProfit = historyRecords.reduce((sum, record) => {
      const metrics = getClientMetrics(record);
      return sum + Number(metrics.totalProfit || metrics.totalLucro || 0);
    }, 0);

    const paidClients = historyRecords.filter(
      (record) => record.status === "Quitado"
    ).length;

    return {
      clients: historyRecords.length,
      totalLoans,
      totalSent,
      totalProfit,
      paidClients,
    };
  }, [historyRecords]);

  const filteredRecords = useMemo(() => {
    if (filter === "quitados") {
      return historyRecords.filter((record) => record.status === "Quitado");
    }

    if (filter === "comHistorico") {
      return historyRecords.filter(
        (record) =>
          Array.isArray(record.historicoEmprestimos) &&
          record.historicoEmprestimos.length > 0
      );
    }

    if (filter === "bons") {
      return historyRecords.filter(
        (record) => getClientRisk(record).label === "Bom pagador"
      );
    }

    return historyRecords;
  }, [historyRecords, filter]);

  return (
    <div className="space-y-4">
      <div className="card-dark rounded-2xl p-4 md:p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-300">
            Histórico
          </p>

          <h2 className="mt-2 text-2xl font-bold text-white">
            Histórico de empréstimos
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Veja clientes quitados, empréstimos antigos e lucro acumulado.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <SummaryCard label="Clientes" value={summary.clients} tone="slate" />
        <SummaryCard label="Empréstimos" value={summary.totalLoans} tone="orange" />
        <SummaryCard label="Quitados" value={summary.paidClients} tone="green" />
        <SummaryCard
          label="Total enviado"
          value={money.format(summary.totalSent)}
          tone="amber"
        />
        <SummaryCard
          label="Lucro total"
          value={money.format(summary.totalProfit)}
          tone="green"
        />
      </div>

      <div className="card-dark rounded-2xl p-3">
        <div className="flex gap-2 overflow-x-auto">
          <FilterButton active={filter === "todos"} onClick={() => setFilter("todos")}>
            Todos
          </FilterButton>

          <FilterButton
            active={filter === "quitados"}
            onClick={() => setFilter("quitados")}
          >
            Quitados
          </FilterButton>

          <FilterButton
            active={filter === "comHistorico"}
            onClick={() => setFilter("comHistorico")}
          >
            Com histórico
          </FilterButton>

          <FilterButton active={filter === "bons"} onClick={() => setFilter("bons")}>
            Bons pagadores
          </FilterButton>
        </div>
      </div>

      <div className="card-dark rounded-2xl p-4">
        {filteredRecords.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
            {filteredRecords.map((record) => (
              <HistoryCard
                key={record.id}
                record={record}
                onOpenProfile={onOpenProfile}
              />
            ))}
          </div>
        ) : (
          <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/10 text-2xl text-orange-300">
              ↺
            </div>

            <h3 className="mt-4 text-lg font-bold text-white">
              Nenhum histórico encontrado
            </h3>

            <p className="mt-2 max-w-md text-sm text-slate-500">
              Quando clientes forem quitados ou tiverem novos empréstimos, eles aparecerão aqui.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
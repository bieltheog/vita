import { useMemo, useState } from "react";
import { money, formatDateBR } from "../utils/helpers";
import { getClientRisk } from "../utils/calculations";

function getFrequencyLabel(value) {
  const raw = String(value || "").toLowerCase();

  if (raw.includes("diário") || raw.includes("diario") || raw.includes("daily")) {
    return "Diário";
  }

  if (raw.includes("semanal") || raw.includes("weekly")) {
    return "Semanal";
  }

  if (
    raw.includes("datas") ||
    raw.includes("fixas") ||
    raw.includes("fixed")
  ) {
    return "Datas Fixas";
  }

  if (raw.includes("personalizado") || raw.includes("custom")) {
    return "Personalizado";
  }

  return value || "Outro";
}

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

function LoanCard({ item, onOpenProfile, onRemoveHistoryLoan }) {
  const lucro = Number(item.valorReceber || 0) - Number(item.valorEnviado || 0);

  const risk = getClientRisk({
    status: "Quitado",
    pagamentos: {},
  });

  const canRemoveFromHistory =
    item.source === "history" &&
    item.clientId &&
    Number.isInteger(item.historyIndex);

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 transition hover:border-orange-500/20 hover:bg-white/[0.05]">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-base font-bold text-white">
              {String(item.nome || "C").charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0">
              <h4 className="truncate text-lg font-bold text-white">
                {item.nome}
              </h4>

              <p className="mt-1 text-sm text-slate-500">
                Quitado em{" "}
                {item.finalizadoEm
                  ? new Date(item.finalizadoEm).toLocaleDateString("pt-BR")
                  : "Data não encontrada"}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
              Quitado
            </span>

            <span
              className={`rounded-full border px-3 py-1 text-xs font-bold ${risk.className}`}
            >
              {risk.label}
            </span>

            <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-400">
              {item.frequenciaLabel}
            </span>
          </div>
        </div>

        <div className="text-left md:text-right">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
            Lucro
          </p>

          <p className="mt-1 text-xl font-bold text-emerald-300">
            {money.format(lucro)}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-white/[0.06] bg-[#0d1016] p-3">
          <p className="text-xs text-slate-500">Valor enviado</p>
          <p className="mt-1 font-bold text-white">
            {money.format(item.valorEnviado || 0)}
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-[#0d1016] p-3">
          <p className="text-xs text-slate-500">Valor recebido</p>
          <p className="mt-1 font-bold text-white">
            {money.format(item.valorReceber || 0)}
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-[#0d1016] p-3">
          <p className="text-xs text-slate-500">% retorno</p>
          <p className="mt-1 font-bold text-orange-300">
            {item.porcentagemRetorno || 0}%
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-[#0d1016] p-3">
          <p className="text-xs text-slate-500">Período</p>
          <p className="mt-1 font-bold text-white">
            {item.dataInicio ? formatDateBR(item.dataInicio) : "-"} →{" "}
            {item.dataTermino ? formatDateBR(item.dataTermino) : "-"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col justify-end gap-2 border-t border-white/[0.06] pt-4 sm:flex-row">
        <button
          type="button"
          onClick={() => onOpenProfile?.(item.originalClient)}
          className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-orange-600"
        >
          Abrir ficha
        </button>

        {canRemoveFromHistory && (
          <button
            type="button"
            onClick={() =>
              onRemoveHistoryLoan?.(item.clientId, item.historyIndex)
            }
            className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-rose-700"
          >
            Apagar do histórico
          </button>
        )}
      </div>
    </div>
  );
}

export default function HistoryView({
  records = [],
  onOpenProfile,
  onRemoveHistoryLoan,
}) {
  const [filter, setFilter] = useState("todos");

  const historyLoans = useMemo(() => {
    const result = [];

    records.forEach((record) => {
      const history = Array.isArray(record.historicoEmprestimos)
        ? record.historicoEmprestimos
        : [];

      history.forEach((loan, index) => {
        result.push({
          ...loan,
          nome: record.nome,
          clientId: record.id,
          historyIndex: index,
          originalClient: record,
          source: "history",
          frequenciaLabel: getFrequencyLabel(loan.frequencia),
        });
      });

      if (record.status === "Quitado" && Number(record.valorReceber || 0) > 0) {
        result.push({
          nome: record.nome,
          clientId: record.id,
          historyIndex: null,
          originalClient: record,
          source: "current",
          valorEnviado: record.valorEnviado,
          valorReceber: record.valorReceber,
          porcentagemRetorno: record.porcentagemRetorno,
          frequencia: record.frequencia,
          dataInicio: record.dataInicio,
          dataTermino: record.dataTermino,
          finalizadoEm: record.updatedAt || record.createdAt || new Date().toISOString(),
          frequenciaLabel: getFrequencyLabel(record.frequencia),
        });
      }
    });

    return result.sort((a, b) => {
      return (
        new Date(b.finalizadoEm || 0).getTime() -
        new Date(a.finalizadoEm || 0).getTime()
      );
    });
  }, [records]);

  const summary = useMemo(() => {
    const totalSent = historyLoans.reduce(
      (sum, item) => sum + Number(item.valorEnviado || 0),
      0
    );

    const totalReceived = historyLoans.reduce(
      (sum, item) => sum + Number(item.valorReceber || 0),
      0
    );

    return {
      totalLoans: historyLoans.length,
      totalSent,
      totalReceived,
      totalProfit: totalReceived - totalSent,
    };
  }, [historyLoans]);

  const filteredLoans = useMemo(() => {
    if (filter === "diario") {
      return historyLoans.filter(
        (item) => getFrequencyLabel(item.frequencia) === "Diário"
      );
    }

    if (filter === "semanal") {
      return historyLoans.filter(
        (item) => getFrequencyLabel(item.frequencia) === "Semanal"
      );
    }

    if (filter === "fixo") {
      return historyLoans.filter(
        (item) => getFrequencyLabel(item.frequencia) === "Datas Fixas"
      );
    }

    return historyLoans;
  }, [historyLoans, filter]);

  return (
    <div className="space-y-4">
      <div className="card-dark rounded-2xl p-4 md:p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-300">
            Histórico
          </p>

          <h2 className="mt-2 text-2xl font-bold text-white">
            Empréstimos quitados
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Apenas empréstimos totalmente pagos aparecem aqui.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard label="Empréstimos" value={summary.totalLoans} tone="slate" />
        <SummaryCard label="Total enviado" value={money.format(summary.totalSent)} tone="amber" />
        <SummaryCard label="Total recebido" value={money.format(summary.totalReceived)} tone="green" />
        <SummaryCard label="Lucro" value={money.format(summary.totalProfit)} tone="orange" />
      </div>

      <div className="card-dark rounded-2xl p-3">
        <div className="flex gap-2 overflow-x-auto">
          <FilterButton active={filter === "todos"} onClick={() => setFilter("todos")}>
            Todos
          </FilterButton>

          <FilterButton active={filter === "diario"} onClick={() => setFilter("diario")}>
            Diário
          </FilterButton>

          <FilterButton active={filter === "semanal"} onClick={() => setFilter("semanal")}>
            Semanal
          </FilterButton>

          <FilterButton active={filter === "fixo"} onClick={() => setFilter("fixo")}>
            Datas Fixas
          </FilterButton>
        </div>
      </div>

      <div className="card-dark rounded-2xl p-4">
        {filteredLoans.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
            {filteredLoans.map((item, index) => (
              <LoanCard
                key={`${item.clientId}-${item.source}-${item.historyIndex ?? index}`}
                item={item}
                onOpenProfile={onOpenProfile}
                onRemoveHistoryLoan={onRemoveHistoryLoan}
              />
            ))}
          </div>
        ) : (
          <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/10 text-2xl text-orange-300">
              ↺
            </div>

            <h3 className="mt-4 text-lg font-bold text-white">
              Nenhum empréstimo quitado
            </h3>

            <p className="mt-2 max-w-md text-sm text-slate-500">
              Quando empréstimos forem totalmente pagos, eles aparecerão aqui.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
import { useMemo, useState } from "react";
import { money, formatDateBR } from "../utils/helpers";
import { paymentTypes } from "../utils/calculations";

function getLoansFromRecord(record) {
  const history = Array.isArray(record.historicoEmprestimos)
    ? record.historicoEmprestimos
    : [];

  const oldLoans = history.map((loan, index) => ({
    id: `${record.id}-history-${index}`,
    clientId: record.id,
    clientName: record.nome,
    cpf: record.cpf,
    whatsapp: record.whatsapp,
    type: "Histórico",
    index: index + 1,
    status: "Finalizado",
    finalizadoEm: loan.finalizadoEm,
    valorEnviado: Number(loan.valorEnviado || 0),
    valorReceber: Number(loan.valorReceber || 0),
    lucro:
      loan.lucro !== undefined
        ? Number(loan.lucro || 0)
        : Number(loan.valorReceber || 0) - Number(loan.valorEnviado || 0),
    frequencia: loan.frequencia,
    dataInicio: loan.dataInicio,
    dataTermino: loan.dataTermino,
    diasPagamentoFixos: loan.diasPagamentoFixos || [],
    parcelasPersonalizadas: loan.parcelasPersonalizadas || [],
  }));

  const currentClosed =
    record.status === "Quitado" && Number(record.valorReceber || 0) > 0
      ? [
          {
            id: `${record.id}-current-closed`,
            clientId: record.id,
            clientName: record.nome,
            cpf: record.cpf,
            whatsapp: record.whatsapp,
            type: "Atual",
            index: history.length + 1,
            status: "Quitado",
            finalizadoEm: record.createdAt || "",
            valorEnviado: Number(record.valorEnviado || 0),
            valorReceber: Number(record.valorReceber || 0),
            lucro: Number(record.valorReceber || 0) - Number(record.valorEnviado || 0),
            frequencia: record.frequencia,
            dataInicio: record.dataInicio,
            dataTermino: record.dataTermino,
            diasPagamentoFixos: record.diasPagamentoFixos || [],
            parcelasPersonalizadas: record.parcelasPersonalizadas || [],
          },
        ]
      : [];

  return [...oldLoans, ...currentClosed];
}

function getFrequencyDescription(loan) {
  if (loan.frequencia === paymentTypes.FIXED_DATES) {
    return `Datas fixas: ${
      Array.isArray(loan.diasPagamentoFixos)
        ? loan.diasPagamentoFixos.join(", ")
        : "-"
    }`;
  }

  if (loan.frequencia === paymentTypes.CUSTOM) {
    return `Personalizado: ${
      Array.isArray(loan.parcelasPersonalizadas)
        ? loan.parcelasPersonalizadas.length
        : 0
    } parcela(s)`;
  }

  if (loan.frequencia === paymentTypes.WEEKLY) {
    return "Semanal";
  }

  if (loan.frequencia === paymentTypes.DAILY) {
    return "Diário";
  }

  return loan.frequencia || "-";
}

function HistoryCard({ loan, onOpenProfile }) {
  return (
    <div className="card-dark card-hover rounded-2xl p-4">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words text-base font-bold text-white">
              {loan.clientName}
            </h3>

            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/12 px-2.5 py-1 text-xs font-semibold text-emerald-300">
              {loan.status}
            </span>

            <span className="rounded-full border border-purple-500/25 bg-purple-500/12 px-2.5 py-1 text-xs font-semibold text-purple-300">
              Empréstimo #{loan.index}
            </span>
          </div>

          <p className="mt-2 text-sm text-slate-500">
            CPF {loan.cpf || "-"} · {loan.whatsapp || "Sem WhatsApp"}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {getFrequencyDescription(loan)} · início {formatDateBR(loan.dataInicio)}
            {loan.dataTermino ? ` · fim ${formatDateBR(loan.dataTermino)}` : ""}
          </p>

          {loan.finalizadoEm && (
            <p className="mt-1 text-xs text-slate-500">
              Finalizado em{" "}
              {new Date(loan.finalizadoEm).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>

        <button
          onClick={() => onOpenProfile({ id: loan.clientId })}
          className="rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-purple-700"
        >
          Abrir cliente
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
          <p className="text-xs text-slate-500">Enviado</p>
          <p className="mt-1 text-sm font-bold text-white">
            {money.format(loan.valorEnviado)}
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
          <p className="text-xs text-slate-500">Recebido</p>
          <p className="mt-1 text-sm font-bold text-purple-300">
            {money.format(loan.valorReceber)}
          </p>
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
          <p className="text-xs text-slate-500">Lucro</p>
          <p className="mt-1 text-sm font-bold text-emerald-300">
            {money.format(loan.lucro)}
          </p>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone }) {
  const tones = {
    purple: "border-purple-500/20 bg-purple-500/10 text-purple-300",
    green: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    cyan: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
    orange: "border-orange-500/20 bg-orange-500/10 text-orange-300",
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] || tones.purple}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-bold">{value}</p>
    </div>
  );
}

export default function HistoryView({ records, onOpenProfile }) {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("Todos");

  const loans = useMemo(() => {
    return (records || []).flatMap(getLoansFromRecord);
  }, [records]);

  const filteredLoans = useMemo(() => {
    const term = search.toLowerCase().trim();

    return loans.filter((loan) => {
      const termMatch =
        !term ||
        `${loan.clientName} ${loan.cpf} ${loan.whatsapp} ${loan.frequencia}`
          .toLowerCase()
          .includes(term);

      const typeMatch = filterType === "Todos" || loan.frequencia === filterType;

      return termMatch && typeMatch;
    });
  }, [loans, search, filterType]);

  const summary = useMemo(() => {
    const enviado = filteredLoans.reduce(
      (sum, loan) => sum + Number(loan.valorEnviado || 0),
      0
    );

    const recebido = filteredLoans.reduce(
      (sum, loan) => sum + Number(loan.valorReceber || 0),
      0
    );

    const lucro = filteredLoans.reduce(
      (sum, loan) => sum + Number(loan.lucro || 0),
      0
    );

    return {
      total: filteredLoans.length,
      enviado,
      recebido,
      lucro,
    };
  }, [filteredLoans]);

  function openLoanProfile(loanRef) {
    const record = (records || []).find((item) => item.id === loanRef.id);

    if (record) {
      onOpenProfile(record);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card-dark rounded-2xl p-4 md:p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-purple-300">
              Histórico
            </p>

            <h2 className="mt-2 text-2xl font-bold text-white">
              Empréstimos finalizados
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Consulte empréstimos anteriores e fichas quitadas.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:min-w-[620px]">
            <SummaryCard
              label="Total"
              value={summary.total}
              tone="purple"
            />

            <SummaryCard
              label="Enviado"
              value={money.format(summary.enviado)}
              tone="cyan"
            />

            <SummaryCard
              label="Recebido"
              value={money.format(summary.recebido)}
              tone="purple"
            />

            <SummaryCard
              label="Lucro"
              value={money.format(summary.lucro)}
              tone="green"
            />
          </div>
        </div>
      </div>

      <div className="card-dark rounded-2xl p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_240px]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente, CPF, WhatsApp ou tipo..."
            className="input-dark rounded-xl px-4 py-3 text-sm outline-none"
          />

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="input-dark rounded-xl px-4 py-3 text-sm outline-none"
          >
            <option>Todos</option>
            <option>{paymentTypes.DAILY}</option>
            <option>{paymentTypes.WEEKLY}</option>
            <option>{paymentTypes.FIXED_DATES}</option>
            <option>{paymentTypes.CUSTOM}</option>
          </select>
        </div>
      </div>

      {filteredLoans.length === 0 ? (
        <div className="card-dark rounded-2xl p-10 text-center">
          <p className="font-bold text-white">Nenhum histórico encontrado</p>
          <p className="mt-1 text-sm text-slate-500">
            Quando clientes forem quitados ou iniciarem novos empréstimos, o histórico aparecerá aqui.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filteredLoans.map((loan) => (
            <HistoryCard
              key={loan.id}
              loan={loan}
              onOpenProfile={openLoanProfile}
            />
          ))}
        </div>
      )}
    </div>
  );
}
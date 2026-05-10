import { useMemo, useState } from "react";
import { money, formatDateBR } from "../utils/helpers";
import { paymentStatuses } from "../utils/calculations";

function getDaysLate(dateString) {
  if (!dateString) return 0;

  const today = new Date();
  const date = new Date(`${dateString}T00:00:00`);

  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  const diff = today.getTime() - date.getTime();

  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function LateCard({ event }) {
  const daysLate = getDaysLate(event.date);

  return (
    <div className="card-dark card-hover rounded-2xl p-4">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words text-base font-bold text-white">
              {event.nome}
            </h3>

            <span className="rounded-full border border-rose-500/25 bg-rose-500/12 px-2.5 py-1 text-xs font-semibold text-rose-300">
              Atrasado
            </span>

            {event.parcial && (
              <span className="rounded-full border border-cyan-500/25 bg-cyan-500/12 px-2.5 py-1 text-xs font-semibold text-cyan-300">
                Parcial
              </span>
            )}
          </div>

          <p className="mt-2 text-sm text-slate-500">
            Vencimento em {formatDateBR(event.date)} · {daysLate} dia(s) de atraso
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Tipo: {event.tipo || "-"}
            {event.descricao ? ` · ${event.descricao}` : ""}
          </p>

          {event.observacao && (
            <p className="mt-2 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-xs text-slate-400">
              Obs: {event.observacao}
            </p>
          )}
        </div>

        <div className="shrink-0 text-left md:text-right">
          <p className="text-xs text-slate-500">Valor em aberto</p>
          <p className="mt-1 text-xl font-bold text-rose-300">
            {money.format(event.valor || 0)}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Multa: {event.multaPercentual || 0}%
          </p>

          {Number(event.valorPago || 0) > 0 && (
            <p className="mt-1 text-xs text-cyan-300">
              Pago parcial: {money.format(event.valorPago)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone }) {
  const tones = {
    red: "border-rose-500/20 bg-rose-500/10 text-rose-300",
    orange: "border-orange-500/20 bg-orange-500/10 text-orange-300",
    purple: "border-purple-500/20 bg-purple-500/10 text-purple-300",
    cyan: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] || tones.purple}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-bold">{value}</p>
    </div>
  );
}

export default function LatePayments({ delayedEvents }) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("maior-atraso");

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();

    let list = (delayedEvents || []).filter((event) => {
      if (!term) return true;

      return `${event.nome} ${event.tipo} ${event.descricao || ""} ${event.observacao || ""}`
        .toLowerCase()
        .includes(term);
    });

    if (sortBy === "maior-valor") {
      list = [...list].sort((a, b) => Number(b.valor || 0) - Number(a.valor || 0));
    }

    if (sortBy === "menor-valor") {
      list = [...list].sort((a, b) => Number(a.valor || 0) - Number(b.valor || 0));
    }

    if (sortBy === "maior-atraso") {
      list = [...list].sort((a, b) => getDaysLate(b.date) - getDaysLate(a.date));
    }

    if (sortBy === "mais-recente") {
      list = [...list].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    }

    return list;
  }, [delayedEvents, search, sortBy]);

  const summary = useMemo(() => {
    const total = (delayedEvents || []).reduce(
      (sum, event) => sum + Number(event.valor || 0),
      0
    );

    const maiorAtraso = (delayedEvents || []).reduce(
      (max, event) => Math.max(max, getDaysLate(event.date)),
      0
    );

    const parciais = (delayedEvents || []).filter(
      (event) => event.statusPagamento === paymentStatuses.PARTIAL
    ).length;

    return {
      quantidade: delayedEvents?.length || 0,
      total,
      maiorAtraso,
      parciais,
    };
  }, [delayedEvents]);

  return (
    <div className="space-y-4">
      <div className="card-dark rounded-2xl p-4 md:p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-300">
              Atrasados
            </p>

            <h2 className="mt-2 text-2xl font-bold text-white">
              Pagamentos atrasados
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Acompanhe parcelas vencidas, valores em aberto e dias de atraso.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:min-w-[620px]">
            <SummaryCard
              label="Parcelas"
              value={summary.quantidade}
              tone="red"
            />

            <SummaryCard
              label="Valor atrasado"
              value={money.format(summary.total)}
              tone="red"
            />

            <SummaryCard
              label="Maior atraso"
              value={`${summary.maiorAtraso} dia(s)`}
              tone="orange"
            />

            <SummaryCard
              label="Parciais"
              value={summary.parciais}
              tone="cyan"
            />
          </div>
        </div>
      </div>

      <div className="card-dark rounded-2xl p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_240px]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente, tipo ou observação..."
            className="input-dark rounded-xl px-4 py-3 text-sm outline-none"
          />

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="input-dark rounded-xl px-4 py-3 text-sm outline-none"
          >
            <option value="maior-atraso">Maior atraso</option>
            <option value="mais-recente">Mais recente</option>
            <option value="maior-valor">Maior valor</option>
            <option value="menor-valor">Menor valor</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card-dark rounded-2xl p-10 text-center">
          <p className="font-bold text-white">Nenhum atraso encontrado</p>
          <p className="mt-1 text-sm text-slate-500">
            Quando houver parcelas atrasadas, elas aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filtered.map((event) => (
            <LateCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
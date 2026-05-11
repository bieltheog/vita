import { useMemo, useState } from "react";
import { money, formatDateBR } from "../utils/helpers";
import { getClientRisk, getClientMetrics } from "../utils/calculations";

function ClientStatusBadge({ status }) {
  const styles = {
    Ativo: "border-orange-500/25 bg-orange-500/10 text-orange-300",
    Quitado: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
    Recebido: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
    Atrasado: "border-rose-500/25 bg-rose-500/10 text-rose-300",
    Bloqueado: "border-rose-500/25 bg-rose-500/10 text-rose-300",
  };

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-bold ${
        styles[status] || styles.Ativo
      }`}
    >
      {status || "Ativo"}
    </span>
  );
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
    red: "border-rose-500/20 bg-rose-500/10 text-rose-300",
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

function ClientCard({ client, onOpenProfile }) {
  const risk = getClientRisk(client);
  const metrics = getClientMetrics(client);

  const cityState =
    client.cidade || client.estado
      ? `${client.cidade || "-"} / ${client.estado || "-"}`
      : "Sem cidade";

  const lastCreatedAt = client.createdAt
    ? formatDateBR(String(client.createdAt).slice(0, 10))
    : "Sem data";

  return (
    <button
      type="button"
      onClick={() => onOpenProfile?.(client)}
      className="group rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-left transition hover:border-orange-500/30 hover:bg-white/[0.055]"
    >
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-base font-bold text-white">
              {String(client.nome || "C").charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0">
              <h4 className="truncate text-lg font-bold text-white">
                {client.nome || "Cliente sem nome"}
              </h4>

              <p className="mt-1 truncate text-sm text-slate-500">
                {client.whatsapp || "Sem WhatsApp"} · CPF {client.cpf || "-"}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <ClientStatusBadge status={client.status} />

            <span
              className={`rounded-full border px-3 py-1 text-xs font-bold ${risk.className}`}
            >
              {risk.label}
            </span>

            <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-400">
              {client.frequencia || "Sem frequência"}
            </span>
          </div>
        </div>

        <div className="text-left md:text-right">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
            Em aberto
          </p>

          <p className="mt-1 text-lg font-bold text-orange-300">
            {money.format(metrics.totalOpenCurrent || metrics.abertoAtual || 0)}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Criado em {lastCreatedAt}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-white/[0.06] bg-[#0d1016] p-3">
          <p className="text-xs text-slate-500">Enviado</p>
          <p className="mt-1 font-bold text-white">
            {money.format(client.valorEnviado || 0)}
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-[#0d1016] p-3">
          <p className="text-xs text-slate-500">A receber</p>
          <p className="mt-1 font-bold text-white">
            {money.format(client.valorReceber || 0)}
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-[#0d1016] p-3">
          <p className="text-xs text-slate-500">Lucro total</p>
          <p className="mt-1 font-bold text-emerald-300">
            {money.format(metrics.totalProfit || metrics.totalLucro || 0)}
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-[#0d1016] p-3">
          <p className="text-xs text-slate-500">Local</p>
          <p className="mt-1 truncate font-bold text-white">{cityState}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
        <p className="line-clamp-1 text-sm text-slate-500">
          {client.observacao || risk.description || "Sem observações."}
        </p>

        <span className="shrink-0 text-sm font-bold text-orange-300 transition group-hover:text-orange-200">
          Abrir ficha →
        </span>
      </div>
    </button>
  );
}

export default function ClientsTable({
  filtered = [],
  search,
  setSearch,
  loading,
  onOpenProfile,
}) {
  const [filter, setFilter] = useState("todos");

  const clients = Array.isArray(filtered) ? filtered : [];

  const summary = useMemo(() => {
    const active = clients.filter((client) => client.status !== "Quitado");
    const paid = clients.filter((client) => client.status === "Quitado");

    const attention = clients.filter((client) => {
      const risk = getClientRisk(client);
      return risk.label === "Atenção" || risk.label === "Risco alto";
    });

    const highRisk = clients.filter((client) => {
      const risk = getClientRisk(client);
      return risk.label === "Risco alto";
    });

    return {
      total: clients.length,
      active: active.length,
      paid: paid.length,
      attention: attention.length,
      highRisk: highRisk.length,
    };
  }, [clients]);

  const filteredByTab = useMemo(() => {
    if (filter === "ativos") {
      return clients.filter((client) => client.status !== "Quitado");
    }

    if (filter === "quitados") {
      return clients.filter((client) => client.status === "Quitado");
    }

    if (filter === "atencao") {
      return clients.filter((client) => {
        const risk = getClientRisk(client);
        return risk.label === "Atenção" || risk.label === "Risco alto";
      });
    }

    if (filter === "risco") {
      return clients.filter((client) => getClientRisk(client).label === "Risco alto");
    }

    return clients;
  }, [clients, filter]);

  return (
    <div className="space-y-4">
      <div className="card-dark rounded-2xl p-4 md:p-5">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-300">
              Clientes
            </p>

            <h2 className="mt-2 text-2xl font-bold text-white">
              Carteira de clientes
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Busque, filtre e abra a ficha completa de cada cliente.
            </p>
          </div>

          <div className="w-full xl:max-w-[420px]">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, CPF, WhatsApp, cidade..."
              className="input-dark w-full rounded-xl px-4 py-3 text-sm outline-none"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <SummaryCard label="Total" value={summary.total} tone="slate" />
        <SummaryCard label="Ativos" value={summary.active} tone="orange" />
        <SummaryCard label="Quitados" value={summary.paid} tone="green" />
        <SummaryCard label="Atenção" value={summary.attention} tone="amber" />
        <SummaryCard label="Risco alto" value={summary.highRisk} tone="red" />
      </div>

      <div className="card-dark rounded-2xl p-3">
        <div className="flex gap-2 overflow-x-auto">
          <FilterButton active={filter === "todos"} onClick={() => setFilter("todos")}>
            Todos
          </FilterButton>

          <FilterButton active={filter === "ativos"} onClick={() => setFilter("ativos")}>
            Ativos
          </FilterButton>

          <FilterButton
            active={filter === "quitados"}
            onClick={() => setFilter("quitados")}
          >
            Quitados
          </FilterButton>

          <FilterButton
            active={filter === "atencao"}
            onClick={() => setFilter("atencao")}
          >
            Atenção
          </FilterButton>

          <FilterButton active={filter === "risco"} onClick={() => setFilter("risco")}>
            Risco alto
          </FilterButton>
        </div>
      </div>

      <div className="card-dark rounded-2xl p-4">
        {loading ? (
          <div className="flex min-h-[260px] items-center justify-center text-sm text-slate-500">
            Carregando clientes...
          </div>
        ) : filteredByTab.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
            {filteredByTab.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                onOpenProfile={onOpenProfile}
              />
            ))}
          </div>
        ) : (
          <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/10 text-2xl text-orange-300">
              ◌
            </div>

            <h3 className="mt-4 text-lg font-bold text-white">
              Nenhum cliente encontrado
            </h3>

            <p className="mt-2 max-w-md text-sm text-slate-500">
              Tente mudar o filtro ou buscar por outro nome, CPF, WhatsApp ou cidade.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
import { useMemo } from "react";
import { StatCard, PremiumCard } from "./ui";
import { money, formatDateBR } from "../utils/helpers";
import { paymentStatuses } from "../utils/calculations";

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date, amount) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function getLastSevenDays() {
  const today = new Date();

  return Array.from({ length: 7 }).map((_, index) => {
    const date = addDays(today, index - 6);
    return date.toISOString().slice(0, 10);
  });
}

function LineChart({ data }) {
  const width = 760;
  const height = 260;
  const padding = 34;
  const maxValue = Math.max(...data.map((item) => item.value), 1);

  const points = data.map((item, index) => {
    const x =
      padding + (index * (width - padding * 2)) / Math.max(data.length - 1, 1);

    const y =
      height -
      padding -
      (item.value / maxValue) * (height - padding * 2);

    return { x, y };
  });

  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const path2 = points
    .map((point, index) => {
      const y = point.y + 32 > height - padding ? height - padding : point.y + 32;
      return `${index === 0 ? "M" : "L"} ${point.x} ${y}`;
    })
    .join(" ");

  return (
    <div className="h-[270px] w-full overflow-hidden rounded-xl bg-[#0a0f1f] p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
        <defs>
          <linearGradient id="mainLine" x1="0" x2="1">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="55%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>

        {[0, 1, 2, 3].map((line) => {
          const y = padding + line * ((height - padding * 2) / 3);

          return (
            <line
              key={line}
              x1={padding}
              x2={width - padding}
              y1={y}
              y2={y}
              stroke="rgba(148,163,184,0.12)"
              strokeWidth="1"
            />
          );
        })}

        <path
          d={path2}
          fill="none"
          stroke="#06b6d4"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="8 8"
        />

        <path
          d={path}
          fill="none"
          stroke="url(#mainLine)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r="4"
            fill="#0a0f1f"
            stroke="#8b5cf6"
            strokeWidth="3"
          />
        ))}

        {data.map((item, index) => {
          const x =
            padding +
            (index * (width - padding * 2)) / Math.max(data.length - 1, 1);

          return (
            <text
              key={item.date}
              x={x}
              y={height - 6}
              textAnchor="middle"
              fill="#64748b"
              fontSize="12"
              fontWeight="600"
            >
              {item.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function DonutChart({ paid, pending, late, partial }) {
  const total = paid + pending + late + partial;

  const paidPercent = total > 0 ? (paid / total) * 100 : 0;
  const partialPercent = total > 0 ? (partial / total) * 100 : 0;
  const pendingPercent = total > 0 ? (pending / total) * 100 : 0;

  const style = {
    background:
      total > 0
        ? `conic-gradient(
          #7c3aed 0% ${paidPercent}%,
          #06b6d4 ${paidPercent}% ${paidPercent + partialPercent}%,
          #f59e0b ${paidPercent + partialPercent}% ${
            paidPercent + partialPercent + pendingPercent
          }%,
          #ec4899 ${paidPercent + partialPercent + pendingPercent}% 100%
        )`
        : "#1e293b",
  };

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-36 w-36 shrink-0 rounded-full" style={style}>
        <div className="absolute inset-7 rounded-full bg-[#111827]" />
      </div>

      <div className="grid w-full grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-white/[0.04] p-3">
          <p className="text-xs text-slate-500">Pagas</p>
          <strong className="text-purple-300">{paid}</strong>
        </div>

        <div className="rounded-xl bg-white/[0.04] p-3">
          <p className="text-xs text-slate-500">Parciais</p>
          <strong className="text-cyan-300">{partial}</strong>
        </div>

        <div className="rounded-xl bg-white/[0.04] p-3">
          <p className="text-xs text-slate-500">Pendentes</p>
          <strong className="text-orange-300">{pending}</strong>
        </div>

        <div className="rounded-xl bg-white/[0.04] p-3">
          <p className="text-xs text-slate-500">Atrasadas</p>
          <strong className="text-pink-300">{late}</strong>
        </div>
      </div>
    </div>
  );
}

function BarChart({ data }) {
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="flex h-44 items-end gap-3 rounded-xl bg-[#0a0f1f] p-4">
      {data.map((item) => (
        <div key={item.label} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex h-32 w-full items-end rounded-md bg-white/[0.04]">
            <div
              className="w-full rounded-md bg-gradient-to-t from-purple-700 to-purple-400"
              style={{ height: `${Math.max(8, (item.value / max) * 100)}%` }}
            />
          </div>

          <span className="text-xs text-slate-500">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function ActivityItem({ icon, title, subtitle, tone = "purple" }) {
  const tones = {
    purple: "bg-purple-500/12 text-purple-300",
    green: "bg-emerald-500/12 text-emerald-300",
    red: "bg-rose-500/12 text-rose-300",
    orange: "bg-orange-500/12 text-orange-300",
    cyan: "bg-cyan-500/12 text-cyan-300",
  };

  return (
    <div className="flex items-center gap-3 border-b border-white/[0.06] py-3 last:border-0">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
          tones[tone] || tones.purple
        }`}
      >
        {icon}
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">{title}</p>
        <p className="truncate text-xs text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}

function RecentClientCard({ event }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-pink-500 text-sm font-bold text-white">
          {String(event.nome || "C").charAt(0)}
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{event.nome}</p>
          <p className="text-xs text-slate-500">{formatDateBR(event.date)}</p>
        </div>
      </div>

      <p className="mt-3 text-sm font-bold text-white">
        {money.format(event.valor)}
      </p>

      <span className="mt-2 inline-flex rounded-full bg-purple-500/12 px-2.5 py-1 text-xs font-semibold text-purple-300">
        {event.statusPagamento}
      </span>
    </div>
  );
}

export default function Dashboard({ totals, calendarEvents, onGoToTab }) {
  const stats = useMemo(() => {
    const paid = calendarEvents.filter(
      (event) => event.statusPagamento === paymentStatuses.PAID
    );

    const pending = calendarEvents.filter(
      (event) => event.statusPagamento === paymentStatuses.PENDING
    );

    const late = calendarEvents.filter(
      (event) => event.statusPagamento === paymentStatuses.LATE
    );

    const partial = calendarEvents.filter(
      (event) => event.statusPagamento === paymentStatuses.PARTIAL
    );

    const today = isoToday();
    const todayEvents = calendarEvents.filter((event) => event.date === today);

    const totalAberto = calendarEvents.reduce(
      (sum, event) => sum + Number(event.saldo || event.valor || 0),
      0
    );

    const totalAtrasado = late.reduce(
      (sum, event) => sum + Number(event.saldo || event.valor || 0),
      0
    );

    const totalHoje = todayEvents.reduce(
      (sum, event) => sum + Number(event.saldo || event.valor || 0),
      0
    );

    return {
      paid,
      pending,
      late,
      partial,
      todayEvents,
      totalAberto,
      totalAtrasado,
      totalHoje,
    };
  }, [calendarEvents]);

  const lineData = useMemo(() => {
    const days = getLastSevenDays();

    return days.map((date) => {
      const total = calendarEvents
        .filter((event) => event.date === date)
        .reduce(
          (sum, event) => sum + Number(event.valorOriginal || event.valor || 0),
          0
        );

      const label = new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      });

      return { date, label, value: total };
    });
  }, [calendarEvents]);

  const weekBars = useMemo(() => {
    const labels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    return labels.map((label, index) => {
      const count = calendarEvents.filter((event) => {
        const day = new Date(`${event.date}T00:00:00`).getDay();
        return day === index;
      }).length;

      return { label, value: count };
    });
  }, [calendarEvents]);

  const recentEvents = calendarEvents.slice(0, 4);

  function go(tab) {
    if (typeof onGoToTab === "function") {
      onGoToTab(tab);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <StatCard
          title="Total Emprestado"
          value={money.format(totals.enviadoGeral || totals.enviado || 0)}
          icon="▣"
          tone="purple"
          subtitle="↑ visão geral"
        />

        <StatCard
          title="Receber Hoje"
          value={money.format(stats.totalHoje)}
          icon="↓"
          tone="green"
          subtitle={`${stats.todayEvents.length} parcela(s)`}
        />

        <StatCard
          title="Lucro"
          value={money.format(totals.lucroGeral || totals.lucro || 0)}
          icon="⌁"
          tone="pink"
          subtitle="↑ acumulado"
        />

        <StatCard
          title="Atrasados"
          value={money.format(stats.totalAtrasado)}
          icon="!"
          tone="orange"
          subtitle="atenção"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.45fr_0.85fr]">
        <PremiumCard>
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-base font-bold text-white">Recebimentos</h3>
              <p className="text-xs text-slate-500">Movimentação dos últimos 7 dias</p>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1 text-slate-400">
                <span className="h-2 w-2 rounded-full bg-purple-500" />
                Recebido
              </span>
              <span className="flex items-center gap-1 text-slate-400">
                <span className="h-2 w-2 rounded-full bg-cyan-400" />
                Previsto
              </span>
            </div>
          </div>

          <LineChart data={lineData} />
        </PremiumCard>

        <PremiumCard>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white">Resumo Financeiro</h3>
              <p className="text-xs text-slate-500">Distribuição das parcelas</p>
            </div>

            <button
              type="button"
              onClick={() => go("calendario")}
              className="rounded-lg bg-white/[0.04] px-3 py-2 text-xs font-bold text-purple-300 hover:bg-white/[0.08]"
            >
              Ver relatório
            </button>
          </div>

          <DonutChart
            paid={stats.paid.length}
            pending={stats.pending.length}
            late={stats.late.length}
            partial={stats.partial.length}
          />
        </PremiumCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.85fr_1.05fr_0.85fr]">
        <PremiumCard>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-white">Clientes</h3>

            <button
              type="button"
              onClick={() => go("clientes")}
              className="text-xs font-semibold text-purple-300 hover:text-purple-200"
            >
              Ver todos
            </button>
          </div>

          <BarChart data={weekBars} />
        </PremiumCard>

        <PremiumCard>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-white">Distribuição de Parcelas</h3>

            <button
              type="button"
              onClick={() => go("calendario")}
              className="text-xs font-semibold text-purple-300 hover:text-purple-200"
            >
              Ver relatório
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-white/[0.04] p-4">
              <p className="text-xs text-slate-500">Em dia</p>
              <strong className="text-2xl text-purple-300">{stats.paid.length}</strong>
            </div>

            <div className="rounded-xl bg-white/[0.04] p-4">
              <p className="text-xs text-slate-500">Pendentes</p>
              <strong className="text-2xl text-orange-300">{stats.pending.length}</strong>
            </div>

            <div className="rounded-xl bg-white/[0.04] p-4">
              <p className="text-xs text-slate-500">Atrasadas</p>
              <strong className="text-2xl text-pink-300">{stats.late.length}</strong>
            </div>
          </div>

          <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-white/[0.05]">
            <div className="flex h-full">
              <div
                className="bg-purple-500"
                style={{
                  width: `${
                    calendarEvents.length
                      ? (stats.paid.length / calendarEvents.length) * 100
                      : 0
                  }%`,
                }}
              />

              <div
                className="bg-orange-400"
                style={{
                  width: `${
                    calendarEvents.length
                      ? (stats.pending.length / calendarEvents.length) * 100
                      : 0
                  }%`,
                }}
              />

              <div
                className="bg-pink-500"
                style={{
                  width: `${
                    calendarEvents.length
                      ? (stats.late.length / calendarEvents.length) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        </PremiumCard>

        <PremiumCard>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-bold text-white">Atividade Recente</h3>

            <button
              type="button"
              onClick={() => go("calendario")}
              className="text-xs font-semibold text-purple-300 hover:text-purple-200"
            >
              Ver todas
            </button>
          </div>

          <div>
            {calendarEvents.slice(0, 4).map((event) => {
              const status = event.statusPagamento;

              const tone =
                status === paymentStatuses.PAID
                  ? "green"
                  : status === paymentStatuses.LATE
                  ? "red"
                  : status === paymentStatuses.PARTIAL
                  ? "cyan"
                  : "orange";

              const icon =
                status === paymentStatuses.PAID
                  ? "✓"
                  : status === paymentStatuses.LATE
                  ? "!"
                  : status === paymentStatuses.PARTIAL
                  ? "%"
                  : "•";

              return (
                <ActivityItem
                  key={event.id}
                  icon={icon}
                  title={event.nome}
                  subtitle={`${formatDateBR(event.date)} · ${money.format(event.valor)}`}
                  tone={tone}
                />
              );
            })}

            {calendarEvents.length === 0 && (
              <p className="rounded-xl bg-white/[0.04] p-3 text-sm text-slate-500">
                Nenhuma atividade ainda.
              </p>
            )}
          </div>
        </PremiumCard>
      </div>

      <PremiumCard>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-white">Clientes Recentes</h3>

          <button
            type="button"
            onClick={() => go("clientes")}
            className="text-xs font-semibold text-purple-300 hover:text-purple-200"
          >
            Ver todos
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {recentEvents.map((event) => (
            <RecentClientCard key={event.id} event={event} />
          ))}

          {recentEvents.length === 0 && (
            <p className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-500">
              Nenhum cliente recente.
            </p>
          )}
        </div>
      </PremiumCard>
    </div>
  );
}
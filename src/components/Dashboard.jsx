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

function MiniLineChart({ data }) {
  const width = 720;
  const height = 250;
  const padding = 28;

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

  const areaPath = `${path} L ${width - padding} ${height - padding} L ${padding} ${
    height - padding
  } Z`;

  return (
    <div className="h-64 w-full overflow-hidden rounded-[1.4rem] border border-white/10 bg-[#070b1b]/60 p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
        <defs>
          <linearGradient id="lineGradient" x1="0" x2="1">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="55%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>

          <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
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
              stroke="rgba(255,255,255,0.08)"
            />
          );
        })}

        <path d={areaPath} fill="url(#areaGradient)" />
        <path
          d={path}
          fill="none"
          stroke="url(#lineGradient)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r="5"
            fill="#0f172a"
            stroke="#22d3ee"
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
              y={height - 5}
              textAnchor="middle"
              fill="rgba(255,255,255,0.45)"
              fontSize="13"
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
  const latePercent = total > 0 ? (late / total) * 100 : 0;

  const style = {
    background:
      total > 0
        ? `conic-gradient(
          #22c55e 0% ${paidPercent}%,
          #22d3ee ${paidPercent}% ${paidPercent + partialPercent}%,
          #f59e0b ${paidPercent + partialPercent}% ${
            paidPercent + partialPercent + pendingPercent
          }%,
          #f43f5e ${paidPercent + partialPercent + pendingPercent}% 100%
        )`
        : "#27272a",
  };

  return (
    <div className="flex flex-col items-center gap-5 md:flex-row">
      <div className="relative h-44 w-44 shrink-0 rounded-full shadow-2xl" style={style}>
        <div className="absolute inset-7 flex flex-col items-center justify-center rounded-full border border-white/10 bg-[#0b1024]">
          <span className="text-xs text-zinc-500">Parcelas</span>
          <strong className="text-3xl font-black text-white">{total}</strong>
        </div>
      </div>

      <div className="grid w-full grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3">
          <p className="text-zinc-400">Pagas</p>
          <strong className="text-emerald-200">{paid}</strong>
        </div>

        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-3">
          <p className="text-zinc-400">Parciais</p>
          <strong className="text-cyan-200">{partial}</strong>
        </div>

        <div className="rounded-2xl border border-orange-400/20 bg-orange-400/10 p-3">
          <p className="text-zinc-400">Pendentes</p>
          <strong className="text-orange-200">{pending}</strong>
        </div>

        <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-3">
          <p className="text-zinc-400">Atrasadas</p>
          <strong className="text-rose-200">{late}</strong>
        </div>
      </div>
    </div>
  );
}

function BarChart({ data }) {
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="flex h-48 items-end gap-3 rounded-[1.4rem] border border-white/10 bg-[#070b1b]/60 p-4">
      {data.map((item) => (
        <div key={item.label} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex h-36 w-full items-end rounded-full bg-white/5">
            <div
              className="w-full rounded-full bg-gradient-to-t from-purple-600 to-cyan-400 shadow-lg shadow-purple-950/40"
              style={{ height: `${Math.max(8, (item.value / max) * 100)}%` }}
            />
          </div>
          <span className="text-xs text-zinc-500">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function ActivityItem({ icon, title, subtitle, tone = "purple" }) {
  const tones = {
    purple: "bg-purple-500/20 text-purple-200",
    green: "bg-emerald-500/20 text-emerald-200",
    red: "bg-rose-500/20 text-rose-200",
    orange: "bg-orange-500/20 text-orange-200",
    cyan: "bg-cyan-500/20 text-cyan-200",
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
          tones[tone] || tones.purple
        }`}
      >
        {icon}
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-white">{title}</p>
        <p className="truncate text-xs text-zinc-500">{subtitle}</p>
      </div>
    </div>
  );
}

export default function Dashboard({ totals, calendarEvents }) {
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
        .reduce((sum, event) => sum + Number(event.valorOriginal || event.valor || 0), 0);

      const label = new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      });

      return {
        date,
        label,
        value: total,
      };
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

  const recentEvents = calendarEvents.slice(0, 5);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.5fr_0.8fr]">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#151a35] via-[#10152d] to-[#090d1f] p-5 shadow-2xl md:p-7">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-purple-600/20 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />

          <div className="relative">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-purple-300">
              Dashboard
            </p>

            <h2 className="mt-2 text-3xl font-black text-white md:text-5xl">
              Controle <span className="text-purple-300">financeiro</span>
            </h2>

            <p className="mt-3 max-w-2xl text-sm text-zinc-400 md:text-base">
              Visão rápida dos empréstimos, parcelas, atrasos e recebimentos do sistema.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs text-zinc-500">Total emprestado</p>
                <strong className="mt-1 block text-xl text-white">
                  {money.format(totals.enviadoGeral || totals.enviado || 0)}
                </strong>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs text-zinc-500">Receber hoje</p>
                <strong className="mt-1 block text-xl text-cyan-200">
                  {money.format(stats.totalHoje)}
                </strong>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs text-zinc-500">Em aberto</p>
                <strong className="mt-1 block text-xl text-orange-200">
                  {money.format(stats.totalAberto)}
                </strong>
              </div>
            </div>
          </div>
        </div>

        <PremiumCard className="flex flex-col justify-between">
          <div>
            <p className="text-sm font-bold text-zinc-400">Receber hoje</p>
            <h3 className="mt-2 text-3xl font-black text-white">
              {money.format(stats.totalHoje)}
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              {stats.todayEvents.length} parcela(s) previstas para hoje.
            </p>
          </div>

          <div className="mt-5 space-y-2">
            {stats.todayEvents.slice(0, 3).map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between rounded-2xl bg-white/[0.04] px-3 py-2 text-sm"
              >
                <span className="truncate text-zinc-300">{event.nome}</span>
                <strong className="text-purple-200">{money.format(event.valor)}</strong>
              </div>
            ))}

            {stats.todayEvents.length === 0 && (
              <p className="rounded-2xl bg-white/[0.04] p-3 text-sm text-zinc-500">
                Nenhum recebimento previsto para hoje.
              </p>
            )}
          </div>
        </PremiumCard>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard
          title="Clientes"
          value={totals.clientes}
          icon="👥"
          tone="cyan"
        />

        <StatCard
          title="Contas abertas"
          value={totals.contas}
          icon="🧾"
          tone="purple"
        />

        <StatCard
          title="Lucro geral"
          value={money.format(totals.lucroGeral || totals.lucro || 0)}
          icon="💰"
          tone="green"
        />

        <StatCard
          title="Atrasados"
          value={money.format(stats.totalAtrasado)}
          icon="⚠️"
          tone="red"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.45fr_0.85fr]">
        <PremiumCard>
          <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-xl font-black text-white">Recebimentos</h3>
              <p className="text-sm text-zinc-500">Movimentação dos últimos 7 dias.</p>
            </div>

            <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-zinc-300">
              Últimos 7 dias
            </span>
          </div>

          <MiniLineChart data={lineData} />
        </PremiumCard>

        <PremiumCard>
          <div className="mb-4">
            <h3 className="text-xl font-black text-white">Resumo financeiro</h3>
            <p className="text-sm text-zinc-500">Distribuição das parcelas.</p>
          </div>

          <DonutChart
            paid={stats.paid.length}
            pending={stats.pending.length}
            late={stats.late.length}
            partial={stats.partial.length}
          />
        </PremiumCard>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.9fr_1.1fr_0.8fr]">
        <PremiumCard>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-black text-white">Clientes</h3>
            <span className="text-xs font-semibold text-purple-300">Semana</span>
          </div>

          <BarChart data={weekBars} />
        </PremiumCard>

        <PremiumCard>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black text-white">Distribuição de parcelas</h3>
              <p className="text-sm text-zinc-500">Status geral do sistema.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
              <p className="text-sm text-zinc-400">Pagas</p>
              <strong className="text-3xl text-emerald-200">
                {stats.paid.length}
              </strong>
            </div>

            <div className="rounded-2xl border border-orange-400/20 bg-orange-400/10 p-4">
              <p className="text-sm text-zinc-400">Pendentes</p>
              <strong className="text-3xl text-orange-200">
                {stats.pending.length}
              </strong>
            </div>

            <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4">
              <p className="text-sm text-zinc-400">Atrasadas</p>
              <strong className="text-3xl text-rose-200">
                {stats.late.length}
              </strong>
            </div>
          </div>

          <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/5">
            <div className="flex h-full">
              <div
                className="bg-emerald-400"
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
                className="bg-rose-400"
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
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-black text-white">Atividade recente</h3>
            <span className="text-xs font-semibold text-purple-300">Ver todas</span>
          </div>

          <div className="space-y-3">
            {recentEvents.map((event) => {
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

            {recentEvents.length === 0 && (
              <p className="rounded-2xl bg-white/[0.04] p-3 text-sm text-zinc-500">
                Nenhuma atividade ainda.
              </p>
            )}
          </div>
        </PremiumCard>
      </div>
    </div>
  );
}
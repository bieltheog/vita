import { useMemo } from "react";
import { StatCard } from "./ui";
import { money } from "../utils/helpers";
import { paymentStatuses } from "../utils/calculations";

function PremiumPieChart({ pago, pendente, atrasado, parcial, cancelado }) {
  const total = pago + pendente + atrasado + parcial + cancelado;

  const paidPercent = total > 0 ? (pago / total) * 100 : 0;
  const pendingPercent = total > 0 ? (pendente / total) * 100 : 0;
  const latePercent = total > 0 ? (atrasado / total) * 100 : 0;
  const partialPercent = total > 0 ? (parcial / total) * 100 : 0;
  const canceledPercent = total > 0 ? (cancelado / total) * 100 : 0;

  const pieStyle = {
    background:
      total > 0
        ? `conic-gradient(
            #22c55e 0% ${paidPercent}%,
            #06b6d4 ${paidPercent}% ${paidPercent + partialPercent}%,
            #facc15 ${paidPercent + partialPercent}% ${
            paidPercent + partialPercent + pendingPercent
          }%,
            #f43f5e ${paidPercent + partialPercent + pendingPercent}% ${
            paidPercent + partialPercent + pendingPercent + latePercent
          }%,
            #71717a ${
              paidPercent + partialPercent + pendingPercent + latePercent
            }% 100%
          )`
        : "#27272a",
  };

  const items = [
    {
      label: "Pagas",
      value: pago,
      percent: paidPercent,
      dot: "bg-emerald-400",
      card: "border-emerald-400/20 bg-emerald-400/10",
      text: "text-emerald-200",
    },
    {
      label: "Parciais",
      value: parcial,
      percent: partialPercent,
      dot: "bg-cyan-400",
      card: "border-cyan-400/20 bg-cyan-400/10",
      text: "text-cyan-200",
    },
    {
      label: "Pendentes",
      value: pendente,
      percent: pendingPercent,
      dot: "bg-yellow-300",
      card: "border-yellow-300/20 bg-yellow-300/10",
      text: "text-yellow-100",
    },
    {
      label: "Atrasadas",
      value: atrasado,
      percent: latePercent,
      dot: "bg-rose-400",
      card: "border-rose-400/20 bg-rose-400/10",
      text: "text-rose-200",
    },
    {
      label: "Canceladas",
      value: cancelado,
      percent: canceledPercent,
      dot: "bg-zinc-400",
      card: "border-zinc-500/20 bg-zinc-500/10",
      text: "text-zinc-300",
    },
  ];

  return (
    <div className="premium-glass neon-border rounded-[2rem] p-5 md:p-6 premium-glow">
      <div className="flex flex-col xl:flex-row items-center gap-8">
        <div className="relative shrink-0">
          <div className="absolute -inset-4 rounded-full bg-cyan-400/10 blur-2xl soft-pulse" />
          <div className="absolute -inset-8 rounded-full bg-purple-500/10 blur-3xl" />

          <div
            className="relative w-56 h-56 md:w-72 md:h-72 rounded-full border border-white/10 shadow-2xl"
            style={pieStyle}
          />

          <div className="absolute inset-8 md:inset-10 rounded-full bg-[#071025]/95 border border-white/10 flex flex-col items-center justify-center text-center shadow-inner">
            <p className="text-xs text-cyan-100/60 uppercase tracking-[0.22em]">
              Parcelas
            </p>
            <p className="text-5xl md:text-6xl font-black gradient-text">
              {total}
            </p>
            <p className="text-xs text-zinc-500 mt-1">no total</p>
          </div>
        </div>

        <div className="w-full">
          <div className="mb-5">
            <p className="text-cyan-300 font-bold text-sm uppercase tracking-[0.18em]">
              Visão financeira
            </p>

            <h2 className="text-2xl md:text-4xl font-black mt-1">
              Situação geral dos pagamentos
            </h2>

            <p className="text-sm text-zinc-400 mt-2 max-w-2xl">
              Acompanhe parcelas pagas, pendentes, atrasadas e pagamentos
              parciais em uma visão premium.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            {items.map((item) => (
              <div
                key={item.label}
                className={`rounded-2xl border p-4 ${item.card}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-3 h-3 rounded-full ${item.dot}`} />
                  <p className="text-sm text-zinc-300">{item.label}</p>
                </div>

                <p className={`text-3xl font-black ${item.text}`}>
                  {item.value}
                </p>

                <p className="text-xs text-zinc-500 mt-1">
                  {total > 0 ? `${item.percent.toFixed(1)}%` : "0%"}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniFinanceCard({ title, value, subtitle, icon }) {
  return (
    <div className="premium-glass premium-card-hover rounded-[1.6rem] p-5 relative overflow-hidden">
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-cyan-400/10 blur-2xl" />

      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-cyan-100/65">{title}</p>

          {icon && (
            <div className="h-10 w-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
              {icon}
            </div>
          )}
        </div>

        <p className="text-2xl md:text-3xl font-black mt-2">{value}</p>

        {subtitle && <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

function ProgressLine({ label, value, max, amount, tone }) {
  const width = max > 0 ? Math.max(4, Math.min(100, (value / max) * 100)) : 0;

  const tones = {
    cyan: "from-cyan-400 to-blue-500",
    purple: "from-purple-400 to-fuchsia-500",
    green: "from-emerald-400 to-green-500",
    red: "from-rose-400 to-red-500",
  };

  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-2">
        <span className="text-zinc-400">{label}</span>
        <span className="font-bold">{amount}</span>
      </div>

      <div className="h-3 rounded-full bg-white/5 overflow-hidden border border-white/5">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${
            tones[tone] || tones.cyan
          }`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export default function Dashboard({ totals, calendarEvents }) {
  const paymentStats = useMemo(() => {
    return {
      pago: calendarEvents.filter(
        (event) => event.statusPagamento === paymentStatuses.PAID
      ).length,
      pendente: calendarEvents.filter(
        (event) => event.statusPagamento === paymentStatuses.PENDING
      ).length,
      atrasado: calendarEvents.filter(
        (event) => event.statusPagamento === paymentStatuses.LATE
      ).length,
      parcial: calendarEvents.filter(
        (event) => event.statusPagamento === paymentStatuses.PARTIAL
      ).length,
      cancelado: calendarEvents.filter(
        (event) => event.statusPagamento === paymentStatuses.CANCELED
      ).length,
    };
  }, [calendarEvents]);

  const totalAberto = calendarEvents.reduce(
    (sum, event) => sum + Number(event.saldo || event.valor || 0),
    0
  );

  const totalParcialPago = calendarEvents.reduce(
    (sum, event) => sum + Number(event.valorPago || 0),
    0
  );

  const totalAtrasado = calendarEvents
    .filter((event) => event.statusPagamento === paymentStatuses.LATE)
    .reduce((sum, event) => sum + Number(event.valor || 0), 0);

  const maxFinance = Math.max(
    totals.enviadoGeral || 0,
    totals.receberGeral || 0,
    totals.lucroGeral || 0,
    totalAberto || 0,
    1
  );

  return (
    <div className="space-y-6">
      <div className="premium-glass neon-border premium-glow rounded-[2rem] p-5 md:p-7 overflow-hidden relative">
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-purple-600/20 blur-3xl" />

        <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <p className="text-cyan-300 font-black uppercase tracking-[0.22em] text-xs">
              Dashboard premium
            </p>

            <h2 className="text-4xl md:text-6xl font-black mt-2 leading-tight">
              Controle <span className="gradient-text">financeiro</span>
            </h2>

            <p className="text-zinc-300 mt-3 max-w-2xl">
              Visão geral dos clientes, empréstimos, lucros, parcelas em aberto,
              atrasos e pagamentos parciais.
            </p>
          </div>

          <div className="rounded-[1.5rem] border border-cyan-400/20 bg-cyan-400/10 px-6 py-5 min-w-[260px]">
            <p className="text-xs text-cyan-100/70 uppercase tracking-widest">
              Total emprestado
            </p>
            <p className="text-3xl md:text-4xl font-black text-cyan-100 mt-1">
              {money.format(totals.enviadoGeral || totals.enviado || 0)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Clientes" value={totals.clientes} icon="👥" />
        <StatCard title="Contas abertas" value={totals.contas} icon="🧾" />

        <StatCard
          title="Total emprestado"
          value={money.format(totals.enviadoGeral || totals.enviado || 0)}
          icon="🏦"
        />

        <StatCard title="Em aberto" value={money.format(totalAberto)} icon="⏳" />

        <StatCard
          title="Enviado atual"
          value={money.format(totals.enviado || 0)}
          icon="💸"
        />

        <StatCard
          title="A receber atual"
          value={money.format(totals.receber || 0)}
          icon="📈"
        />

        <StatCard
          title="Lucro atual"
          value={money.format(totals.lucro || 0)}
          icon="📅"
        />

        <StatCard
          title="Lucro geral"
          value={money.format(totals.lucroGeral || totals.lucro || 0)}
          icon="💰"
        />
      </div>

      <PremiumPieChart
        pago={paymentStats.pago}
        pendente={paymentStats.pendente}
        atrasado={paymentStats.atrasado}
        parcial={paymentStats.parcial}
        cancelado={paymentStats.cancelado}
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <MiniFinanceCard
          title="Pagamentos parciais recebidos"
          value={money.format(totalParcialPago)}
          subtitle="Soma do valor já pago parcialmente."
          icon="💠"
        />

        <MiniFinanceCard
          title="Atrasado em aberto"
          value={money.format(totalAtrasado)}
          subtitle="Valor atual das parcelas atrasadas."
          icon="⚠️"
        />

        <MiniFinanceCard
          title="Lucro histórico"
          value={money.format(totals.lucroHistorico || 0)}
          subtitle="Lucro de empréstimos anteriores e quitados."
          icon="📚"
        />
      </div>

      <div className="premium-glass rounded-[2rem] p-5 md:p-6">
        <div className="mb-5">
          <p className="text-cyan-300 text-sm font-bold uppercase tracking-[0.18em]">
            Comparativo
          </p>
          <h2 className="text-2xl md:text-3xl font-black mt-1">
            Resumo financeiro
          </h2>
          <p className="text-zinc-400 mt-1 text-sm">
            Uma leitura rápida dos principais valores do sistema.
          </p>
        </div>

        <div className="space-y-5">
          <ProgressLine
            label="Total emprestado"
            value={totals.enviadoGeral || totals.enviado || 0}
            max={maxFinance}
            amount={money.format(totals.enviadoGeral || totals.enviado || 0)}
            tone="cyan"
          />

          <ProgressLine
            label="Total a receber geral"
            value={totals.receberGeral || totals.receber || 0}
            max={maxFinance}
            amount={money.format(totals.receberGeral || totals.receber || 0)}
            tone="purple"
          />

          <ProgressLine
            label="Lucro geral"
            value={totals.lucroGeral || totals.lucro || 0}
            max={maxFinance}
            amount={money.format(totals.lucroGeral || totals.lucro || 0)}
            tone="green"
          />

          <ProgressLine
            label="Em aberto"
            value={totalAberto}
            max={maxFinance}
            amount={money.format(totalAberto)}
            tone="red"
          />
        </div>
      </div>
    </div>
  );
}
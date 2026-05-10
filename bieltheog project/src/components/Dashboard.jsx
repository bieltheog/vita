import { useMemo } from "react";
import { StatCard } from "./ui";
import { money } from "../utils/helpers";

function MediumPieChart({ pago, pendente, atrasado }) {
  const total = pago + pendente + atrasado;

  const pagoPercent = total > 0 ? (pago / total) * 100 : 0;
  const pendentePercent = total > 0 ? (pendente / total) * 100 : 0;
  const atrasadoPercent = total > 0 ? (atrasado / total) * 100 : 0;

  const pieStyle = {
    background:
      total > 0
        ? `conic-gradient(
            #10b981 0% ${pagoPercent}%,
            #eab308 ${pagoPercent}% ${pagoPercent + pendentePercent}%,
            #ef4444 ${pagoPercent + pendentePercent}% 100%
          )`
        : "#27272a",
  };

  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-xl">
      <div className="flex flex-col lg:flex-row items-center gap-8">
        <div className="relative shrink-0">
          <div
            className="w-56 h-56 md:w-64 md:h-64 rounded-full border border-zinc-800 shadow-2xl"
            style={pieStyle}
          />

          <div className="absolute inset-8 rounded-full bg-zinc-950 border border-zinc-800 flex flex-col items-center justify-center text-center shadow-inner">
            <p className="text-xs text-zinc-500 uppercase tracking-wide">
              Total
            </p>
            <p className="text-4xl font-bold">{total}</p>
            <p className="text-xs text-zinc-500 mt-1">parcelas</p>
          </div>
        </div>

        <div className="w-full">
          <h2 className="text-2xl font-bold">
            Situação geral dos pagamentos
          </h2>

          <p className="text-sm text-zinc-500 mt-1 mb-6">
            Acompanhe quantas parcelas estão pagas, pendentes ou atrasadas.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                <p className="text-sm text-zinc-400">Pagas</p>
              </div>

              <p className="text-3xl font-bold text-emerald-200">{pago}</p>

              <p className="text-xs text-zinc-500 mt-1">
                {total > 0 ? `${pagoPercent.toFixed(1)}% do total` : "0%"}
              </p>
            </div>

            <div className="rounded-2xl border border-yellow-500/20 bg-yellow-950/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full bg-yellow-500" />
                <p className="text-sm text-zinc-400">Pendentes</p>
              </div>

              <p className="text-3xl font-bold text-yellow-200">{pendente}</p>

              <p className="text-xs text-zinc-500 mt-1">
                {total > 0 ? `${pendentePercent.toFixed(1)}% do total` : "0%"}
              </p>
            </div>

            <div className="rounded-2xl border border-red-500/20 bg-red-950/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full bg-red-500" />
                <p className="text-sm text-zinc-400">Atrasadas</p>
              </div>

              <p className="text-3xl font-bold text-red-200">{atrasado}</p>

              <p className="text-xs text-zinc-500 mt-1">
                {total > 0 ? `${atrasadoPercent.toFixed(1)}% do total` : "0%"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard({ totals, calendarEvents }) {
  const paymentStats = useMemo(() => {
    return {
      pago: calendarEvents.filter((event) => event.statusPagamento === "Pago")
        .length,
      pendente: calendarEvents.filter(
        (event) => event.statusPagamento === "Pendente"
      ).length,
      atrasado: calendarEvents.filter(
        (event) => event.statusPagamento === "Atrasado"
      ).length,
    };
  }, [calendarEvents]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Clientes" value={totals.clientes} icon="👥" />

        <StatCard title="Contas abertas" value={totals.contas} icon="🧾" />

        <StatCard
          title="Total emprestado"
          value={money.format(totals.enviadoGeral || totals.enviado || 0)}
          icon="🏦"
        />

        <StatCard
          title="Total enviado atual"
          value={money.format(totals.enviado)}
          icon="💸"
        />

        <StatCard
          title="Total a receber atual"
          value={money.format(totals.receber)}
          icon="📈"
        />

        <StatCard
          title="Lucro atual"
          value={money.format(totals.lucro)}
          icon="📅"
        />

        <StatCard
          title="Lucro histórico"
          value={money.format(totals.lucroHistorico || 0)}
          icon="📚"
        />

        <StatCard
          title="Lucro geral"
          value={money.format(totals.lucroGeral || totals.lucro)}
          icon="💰"
        />

        <StatCard
          title="Histórico quitado"
          value={totals.historico || 0}
          icon="✅"
        />
      </div>

      <MediumPieChart
        pago={paymentStats.pago}
        pendente={paymentStats.pendente}
        atrasado={paymentStats.atrasado}
      />

      <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
        <h2 className="text-2xl font-bold">Resumo geral</h2>

        <p className="text-zinc-500 mt-2">
          O total emprestado soma o dinheiro enviado em empréstimos atuais e
          também os empréstimos salvos no histórico.
        </p>
      </div>
    </div>
  );
}
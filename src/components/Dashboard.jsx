import { useMemo } from "react";
import { money, formatDateBR } from "../utils/helpers";
import { paymentStatuses } from "../utils/calculations";

const ORANGE = "#ff7a1a";
const YELLOW = "#facc15";
const GREEN = "#22c55e";
const RED = "#ef4444";
const CYAN = "#06b6d4";
const CARD = "#171b22";
const CARD_2 = "#1d222b";
const BORDER = "rgba(255,255,255,0.07)";

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

function getDayName(dateString) {
  const names = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const date = new Date(`${dateString}T00:00:00`);
  return names[date.getDay()];
}

function Panel({ children, className = "" }) {
  return (
    <div
      className={`rounded-[18px] border ${className}`}
      style={{
        background: `linear-gradient(180deg, ${CARD} 0%, #12161d 100%)`,
        borderColor: BORDER,
        boxShadow: "0 18px 40px rgba(0,0,0,0.24)",
      }}
    >
      {children}
    </div>
  );
}

function HeaderButton({ children, onClick, active = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border px-3 py-2 text-xs font-bold transition hover:opacity-90"
      style={{
        borderColor: active ? `${ORANGE}88` : BORDER,
        background: active ? "rgba(255,122,26,0.12)" : "rgba(255,255,255,0.03)",
        color: active ? ORANGE : "#cbd5e1",
      }}
    >
      {children}
    </button>
  );
}

function MetricCard({ title, value, subtitle, icon, color = ORANGE }) {
  return (
    <Panel className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-500">{title}</p>

          <h3 className="mt-2 break-words text-xl font-bold text-white">
            {value}
          </h3>

          {subtitle && <p className="mt-2 text-xs text-slate-500">{subtitle}</p>}
        </div>

        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-bold"
          style={{
            color,
            borderColor: `${color}55`,
            background: `${color}16`,
          }}
        >
          {icon}
        </div>
      </div>
    </Panel>
  );
}

function QuickAction({ title, subtitle, icon, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[16px] border p-4 text-left transition hover:-translate-y-[1px] hover:opacity-95"
      style={{
        background: CARD_2,
        borderColor: BORDER,
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-white">{title}</p>
          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        </div>

        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold"
          style={{
            color: ORANGE,
            borderColor: `${ORANGE}55`,
            background: "rgba(255,122,26,0.08)",
          }}
        >
          {icon}
        </div>
      </div>
    </button>
  );
}

function normalizeEvent(event) {
  const status = event.statusPagamento || paymentStatuses.PENDING;

  const isSettled =
    status === paymentStatuses.PAID ||
    status === paymentStatuses.CANCELED;

  const value = Number(
    event.saldo ??
      event.remainingAmount ??
      event.valorComMulta ??
      event.totalWithFine ??
      event.valor ??
      event.amount ??
      0
  );

  const originalValue = Number(
    event.valorOriginal ?? event.originalAmount ?? event.valor ?? event.amount ?? 0
  );

  const paidValue = Number(event.valorPago ?? event.amountPaid ?? 0);

  return {
    ...event,
    name: event.nome || event.clientName || event.nomeCliente || "Cliente",
    status,
    isSettled,
    value: isSettled ? 0 : Math.max(0, value),
    originalValue,
    paidValue,
  };
}

function MainChart({ dataA = [], dataB = [] }) {
  const safeDataA = Array.isArray(dataA) ? dataA : [];
  const safeDataB = Array.isArray(dataB) ? dataB : [];

  const width = 820;
  const height = 285;
  const padX = 34;
  const padTop = 22;
  const padBottom = 34;

  const maxValue = Math.max(
    ...safeDataA.map((item) => Number(item.value || 0)),
    ...safeDataB.map((item) => Number(item.value || 0)),
    1
  );

  function makePoints(data) {
    return data.map((item, index) => {
      const x =
        padX + (index * (width - padX * 2)) / Math.max(data.length - 1, 1);

      const y =
        height -
        padBottom -
        (Number(item.value || 0) / maxValue) * (height - padTop - padBottom);

      return { x, y };
    });
  }

  const pointsA = makePoints(safeDataA);
  const pointsB = makePoints(safeDataB);

  function makePath(points) {
    return points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");
  }

  const pathA = makePath(pointsA);
  const pathB = makePath(pointsB);

  const areaPath =
    pointsA.length > 0
      ? `${pathA} L ${width - padX} ${height - padBottom} L ${padX} ${
          height - padBottom
        } Z`
      : "";

  return (
    <div
      className="rounded-[16px] border p-3"
      style={{
        background: "#10141b",
        borderColor: BORDER,
      }}
    >
      <div className="mb-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-bold text-white">Fluxo de recebimentos</p>

          <p className="text-xs text-slate-500">
            Recebido x previsto nos últimos 7 dias
          </p>
        </div>

        <div className="flex gap-4 text-xs">
          <span className="flex items-center gap-2 text-slate-300">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: ORANGE }}
            />
            Previsto
          </span>

          <span className="flex items-center gap-2 text-slate-300">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: YELLOW }}
            />
            Recebido
          </span>
        </div>
      </div>

      <div className="h-[270px] overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
          <defs>
            <linearGradient id="orangeAreaSaasSafe" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={ORANGE} stopOpacity="0.55" />
              <stop offset="100%" stopColor={ORANGE} stopOpacity="0.03" />
            </linearGradient>
          </defs>

          {[0, 1, 2, 3, 4].map((line) => {
            const y = padTop + line * ((height - padTop - padBottom) / 4);

            return (
              <line
                key={line}
                x1={padX}
                x2={width - padX}
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,0.06)"
              />
            );
          })}

          {areaPath && <path d={areaPath} fill="url(#orangeAreaSaasSafe)" />}

          {pathA && (
            <path
              d={pathA}
              fill="none"
              stroke={ORANGE}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {pathB && (
            <path
              d={pathB}
              fill="none"
              stroke={YELLOW}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="7 7"
            />
          )}

          {pointsA.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r="4"
              fill={ORANGE}
              stroke="#111827"
              strokeWidth="2"
            />
          ))}

          {safeDataA.map((item, index) => {
            const x =
              padX +
              (index * (width - padX * 2)) / Math.max(safeDataA.length - 1, 1);

            return (
              <text
                key={item.date || index}
                x={x}
                y={height - 8}
                textAnchor="middle"
                fill="#7c8799"
                fontSize="12"
                fontWeight="600"
              >
                {item.label}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function StatusDonut({ paid = 0, pending = 0, late = 0, partial = 0 }) {
  const total = paid + pending + late + partial;

  const paidPercent = total ? (paid / total) * 100 : 0;
  const partialPercent = total ? (partial / total) * 100 : 0;
  const pendingPercent = total ? (pending / total) * 100 : 0;

  const style = {
    background: total
      ? `conic-gradient(
          ${GREEN} 0% ${paidPercent}%,
          ${CYAN} ${paidPercent}% ${paidPercent + partialPercent}%,
          ${YELLOW} ${paidPercent + partialPercent}% ${
          paidPercent + partialPercent + pendingPercent
        }%,
          ${RED} ${paidPercent + partialPercent + pendingPercent}% 100%
        )`
      : "#263142",
  };

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <div className="relative h-32 w-32 shrink-0 rounded-full" style={style}>
        <div
          className="absolute inset-7 flex flex-col items-center justify-center rounded-full"
          style={{ background: CARD }}
        >
          <span className="text-[10px] text-slate-500">Parcelas</span>
          <strong className="text-2xl text-white">{total}</strong>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-white/[0.04] p-3">
          <p className="text-slate-500">Pagas</p>
          <strong className="text-emerald-400">{paid}</strong>
        </div>

        <div className="rounded-xl bg-white/[0.04] p-3">
          <p className="text-slate-500">Parciais</p>
          <strong className="text-cyan-400">{partial}</strong>
        </div>

        <div className="rounded-xl bg-white/[0.04] p-3">
          <p className="text-slate-500">Pendentes</p>
          <strong className="text-yellow-400">{pending}</strong>
        </div>

        <div className="rounded-xl bg-white/[0.04] p-3">
          <p className="text-slate-500">Atrasadas</p>
          <strong className="text-red-400">{late}</strong>
        </div>
      </div>
    </div>
  );
}

function AlertItem({ title, subtitle, value, color = ORANGE, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-[14px] border p-3 text-left transition hover:opacity-90"
      style={{
        background: CARD_2,
        borderColor: BORDER,
      }}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-white">{title}</p>
        <p className="mt-1 truncate text-xs text-slate-500">{subtitle}</p>
      </div>

      <strong className="shrink-0 text-sm" style={{ color }}>
        {value}
      </strong>
    </button>
  );
}

function ActivityItem({ title, subtitle, value, positive }) {
  return (
    <div className="flex items-center gap-3 border-b border-white/[0.06] py-3 last:border-0">
      <span
        className="h-3 w-3 shrink-0 rounded-full"
        style={{ background: positive ? GREEN : ORANGE }}
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{title}</p>
        <p className="truncate text-xs text-slate-500">{subtitle}</p>
      </div>

      <p
        className="shrink-0 text-sm font-bold"
        style={{ color: positive ? GREEN : RED }}
      >
        {positive ? "+" : "-"} {value}
      </p>
    </div>
  );
}

function ClientMiniCard({ event }) {
  return (
    <div
      className="rounded-[14px] border p-3"
      style={{
        background: CARD_2,
        borderColor: BORDER,
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{
            background: `linear-gradient(135deg, ${ORANGE}, #ffb15c)`,
          }}
        >
          {String(event.name || "C").charAt(0)}
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">{event.name}</p>
          <p className="text-xs text-slate-500">{formatDateBR(event.date)}</p>
        </div>
      </div>

      <p className="mt-3 text-sm font-bold text-white">
        {money.format(event.value || event.originalValue || 0)}
      </p>
    </div>
  );
}

export default function Dashboard({
  totals = {},
  calendarEvents = [],
  onGoToTab,
}) {
  const events = useMemo(
    () => (Array.isArray(calendarEvents) ? calendarEvents.map(normalizeEvent) : []),
    [calendarEvents]
  );

  const stats = useMemo(() => {
    const paid = events.filter(
      (event) => event.status === paymentStatuses.PAID
    );

    const pending = events.filter(
      (event) =>
        !event.status ||
        event.status === paymentStatuses.PENDING
    );

    const late = events.filter(
      (event) => event.status === paymentStatuses.LATE
    );

    const partial = events.filter(
      (event) => event.status === paymentStatuses.PARTIAL
    );

    const today = isoToday();
    const todayEvents = events.filter((event) => event.date === today && !event.isSettled);

    const totalPrevisto = events.reduce(
      (sum, event) => sum + Number(event.originalValue || event.value || 0),
      0
    );

    const totalRecebido = paid
      .concat(partial)
      .reduce(
        (sum, event) => sum + Number(event.paidValue || event.valorPago || event.originalValue || 0),
        0
      );

    const totalAtrasado = late.reduce(
      (sum, event) => sum + Number(event.value || 0),
      0
    );

    const totalHoje = todayEvents.reduce(
      (sum, event) => sum + Number(event.value || 0),
      0
    );

    const emAberto = pending
      .concat(late)
      .concat(partial)
      .filter((event) => !event.isSettled)
      .reduce((sum, event) => sum + Number(event.value || 0), 0);

    const recent = [...events]
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 5);

    return {
      paid,
      pending,
      late,
      partial,
      todayEvents,
      totalPrevisto,
      totalRecebido,
      totalAtrasado,
      totalHoje,
      emAberto,
      recent,
    };
  }, [events]);

  const chartData = useMemo(() => {
    const days = getLastSevenDays();

    const expected = days.map((day) => ({
      date: day,
      label: getDayName(day),
      value: events
        .filter((event) => event.date === day)
        .reduce(
          (sum, event) => sum + Number(event.originalValue || event.value || 0),
          0
        ),
    }));

    const received = days.map((day) => ({
      date: day,
      label: getDayName(day),
      value: events
        .filter(
          (event) =>
            event.date === day &&
            (event.status === paymentStatuses.PAID ||
              event.status === paymentStatuses.PARTIAL)
        )
        .reduce(
          (sum, event) => sum + Number(event.paidValue || event.originalValue || 0),
          0
        ),
    }));

    return { expected, received };
  }, [events]);

  const totalEmprestado =
    totals.enviadoGeral ||
    totals.enviado ||
    totals.totalEmprestado ||
    totals.totalEnviadoAtual ||
    0;

  const totalReceber =
    totals.receberGeral ||
    totals.receber ||
    totals.totalReceber ||
    totals.totalReceberAtual ||
    0;

  const lucro =
    totals.lucroGeral ||
    totals.lucro ||
    totals.lucroAtual ||
    Number(totalReceber) - Number(totalEmprestado);

  function go(tab) {
    if (typeof onGoToTab === "function") {
      onGoToTab(tab);
    }
  }

  return (
    <div className="space-y-4">
      <Panel className="overflow-hidden p-4 md:p-5">
        <div className="mb-5 flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
              Painel financeiro
            </p>

            <h2 className="mt-1 text-2xl font-bold text-white md:text-3xl">
              Visão geral da Jureminha
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Controle de clientes, empréstimos, parcelas e recebimentos.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <HeaderButton active onClick={() => go("novo")}>
              + Novo cliente
            </HeaderButton>

            <HeaderButton onClick={() => go("clientes")}>Clientes</HeaderButton>

            <HeaderButton onClick={() => go("calendario")}>
              Calendário
            </HeaderButton>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <QuickAction
            title="Receber hoje"
            subtitle={`${stats.todayEvents.length} parcela(s) previstas`}
            icon="↓"
            onClick={() => go("calendario")}
          />

          <QuickAction
            title="Clientes"
            subtitle={`${totals.clientes || 0} cliente(s) cadastrados`}
            icon="◌"
            onClick={() => go("clientes")}
          />

          <QuickAction
            title="Atrasados"
            subtitle={`${stats.late.length} parcela(s) em atraso`}
            icon="!"
            onClick={() => go("atrasados")}
          />

          <QuickAction
            title="Histórico"
            subtitle="Empréstimos anteriores"
            icon="↺"
            onClick={() => go("historico")}
          />
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <MetricCard
          title="Total emprestado"
          value={money.format(totalEmprestado)}
          subtitle="valor enviado no geral"
          icon="R$"
          color={ORANGE}
        />

        <MetricCard
          title="A receber"
          value={money.format(totalReceber)}
          subtitle="valor previsto"
          icon="↗"
          color={YELLOW}
        />

        <MetricCard
          title="Lucro"
          value={money.format(lucro)}
          subtitle="resultado previsto"
          icon="%"
          color={GREEN}
        />

        <MetricCard
          title="Atrasado"
          value={money.format(stats.totalAtrasado)}
          subtitle={`${stats.late.length} parcela(s)`}
          icon="!"
          color={RED}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.55fr_0.75fr]">
        <Panel className="p-4">
          <MainChart dataA={chartData.expected} dataB={chartData.received} />
        </Panel>

        <Panel className="p-4">
          <div className="mb-4">
            <h3 className="text-base font-bold text-white">Resumo de parcelas</h3>

            <p className="text-xs text-slate-500">
              Situação geral dos pagamentos
            </p>
          </div>

          <StatusDonut
            paid={stats.paid.length}
            pending={stats.pending.length}
            late={stats.late.length}
            partial={stats.partial.length}
          />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.85fr_0.85fr_1fr]">
        <Panel className="p-4">
          <div className="mb-4">
            <h3 className="text-base font-bold text-white">Alertas</h3>

            <p className="text-xs text-slate-500">
              O que precisa de atenção agora
            </p>
          </div>

          <div className="space-y-3">
            <AlertItem
              title="Receber hoje"
              subtitle="Parcelas previstas para hoje"
              value={money.format(stats.totalHoje)}
              color={GREEN}
              onClick={() => go("calendario")}
            />

            <AlertItem
              title="Valor em aberto"
              subtitle="Pendentes, parciais e atrasados"
              value={money.format(stats.emAberto)}
              color={ORANGE}
              onClick={() => go("calendario")}
            />

            <AlertItem
              title="Atrasados"
              subtitle="Parcelas vencidas"
              value={money.format(stats.totalAtrasado)}
              color={RED}
              onClick={() => go("atrasados")}
            />
          </div>
        </Panel>

        <Panel className="p-4">
          <div className="mb-4">
            <h3 className="text-base font-bold text-white">Atividade recente</h3>

            <p className="text-xs text-slate-500">
              Últimas parcelas registradas
            </p>
          </div>

          <div>
            {stats.recent.length > 0 ? (
              stats.recent.slice(0, 4).map((event) => {
                const positive =
                  event.status === paymentStatuses.PAID ||
                  event.status === paymentStatuses.PARTIAL;

                return (
                  <ActivityItem
                    key={event.id}
                    title={event.name}
                    subtitle={`${formatDateBR(event.date)} · ${event.tipo || event.typeLabel || ""}`}
                    value={money.format(event.value || event.originalValue || 0)}
                    positive={positive}
                  />
                );
              })
            ) : (
              <p className="py-6 text-sm text-slate-500">
                Nenhuma atividade ainda.
              </p>
            )}
          </div>
        </Panel>

        <Panel className="p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white">
                Clientes recentes
              </h3>

              <p className="text-xs text-slate-500">
                Últimas movimentações no calendário
              </p>
            </div>

            <button
              type="button"
              onClick={() => go("clientes")}
              className="text-xs font-bold"
              style={{ color: ORANGE }}
            >
              Ver todos
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {stats.recent.slice(0, 4).map((event) => (
              <ClientMiniCard key={event.id} event={event} />
            ))}

            {stats.recent.length === 0 && (
              <p className="rounded-xl bg-white/[0.04] p-4 text-sm text-slate-500">
                Nenhum cliente recente.
              </p>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
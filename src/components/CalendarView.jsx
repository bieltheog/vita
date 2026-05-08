import { useMemo, useState } from "react";
import { money, formatDateBR } from "../utils/helpers";

function getMonthDays(baseDate) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days = [];

  for (let i = 0; i < firstDay.getDay(); i++) days.push(null);

  for (let day = 1; day <= lastDay.getDate(); day++) {
    days.push(new Date(year, month, day));
  }

  return days;
}

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

function getMonthName(date) {
  return date.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

function groupEventsByDate(events) {
  return events.reduce((groups, event) => {
    if (!groups[event.date]) groups[event.date] = [];
    groups[event.date].push(event);
    return groups;
  }, {});
}

export default function CalendarView({
  calendarEvents,
  onMarkPaymentPaid,
  onMarkPaymentLate,
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(toISODate(new Date()));
  const [fineInput, setFineInput] = useState({});

  const monthDays = useMemo(() => getMonthDays(currentMonth), [currentMonth]);
  const groupedEvents = useMemo(() => groupEventsByDate(calendarEvents), [calendarEvents]);
  const selectedEvents = groupedEvents[selectedDate] || [];

  const today = toISODate(new Date());

  function previousMonth() {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }

  function nextMonth() {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }

  function getDaySummary(dateString) {
    const events = groupedEvents[dateString] || [];

    const total = events.reduce((sum, event) => sum + Number(event.valor || 0), 0);
    const paid = events.filter((event) => event.statusPagamento === "Pago").length;
    const late = events.filter((event) => event.statusPagamento === "Atrasado").length;
    const pending = events.filter((event) => event.statusPagamento === "Pendente").length;

    return {
      count: events.length,
      total,
      paid,
      late,
      pending,
    };
  }

  function renderPaymentCard(event) {
    const fineValue = fineInput[event.id] ?? event.multaPercentual ?? 0;

    return (
      <div
        key={event.id}
        className={`rounded-2xl border p-4 ${
          event.statusPagamento === "Pago"
            ? "border-emerald-500/30 bg-emerald-950/20"
            : event.statusPagamento === "Atrasado"
            ? "border-red-500/30 bg-red-950/20"
            : "border-zinc-800 bg-zinc-900"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-bold">{event.nome}</p>
            <p className="text-sm text-zinc-400">
              {event.tipo} · {event.statusPagamento}
            </p>
          </div>

          <div className="text-right">
            <p className="font-bold text-purple-200">
              {money.format(event.valor)}
            </p>

            {event.statusPagamento === "Atrasado" && (
              <p className="text-xs text-red-200">
                Multa {event.multaPercentual || 0}%
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2">
          <button
            type="button"
            onClick={() => onMarkPaymentPaid(event.recordId, event.date)}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-sm font-semibold transition"
          >
            Marcar como pago
          </button>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min="0"
              step="0.01"
              value={fineValue}
              onChange={(e) =>
                setFineInput((prev) => ({
                  ...prev,
                  [event.id]: e.target.value,
                }))
              }
              placeholder="Multa %"
              className="rounded-xl bg-black border border-zinc-800 px-3 py-2 text-sm outline-none focus:border-red-500"
            />

            <button
              type="button"
              onClick={() => onMarkPaymentLate(event.recordId, event.date, fineValue)}
              className="rounded-xl bg-red-600 hover:bg-red-700 px-4 py-2 text-sm font-semibold transition"
            >
              Marcar atraso
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2 rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
          <div>
            <h2 className="text-2xl font-bold">Calendário de pagamentos</h2>
            <p className="text-sm text-zinc-500 mt-1">
              Clique em um dia para ver as pendências na lateral.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={previousMonth}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 hover:border-purple-500 transition"
            >
              ←
            </button>

            <div className="min-w-44 text-center rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 font-semibold capitalize">
              {getMonthName(currentMonth)}
            </div>

            <button
              onClick={nextMonth}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 hover:border-purple-500 transition"
            >
              →
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-zinc-500">
          <div>Dom</div>
          <div>Seg</div>
          <div>Ter</div>
          <div>Qua</div>
          <div>Qui</div>
          <div>Sex</div>
          <div>Sáb</div>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {monthDays.map((date, index) => {
            if (!date) {
              return (
                <div
                  key={`empty-${index}`}
                  className="min-h-24 rounded-2xl border border-transparent"
                />
              );
            }

            const dateString = toISODate(date);
            const summary = getDaySummary(dateString);
            const isSelected = selectedDate === dateString;
            const isToday = dateString === today;

            return (
              <button
                key={dateString}
                type="button"
                onClick={() => setSelectedDate(dateString)}
                className={`min-h-24 rounded-2xl border p-3 text-left transition hover:scale-[1.01] ${
                  isSelected
                    ? "border-purple-500 bg-purple-600/20 shadow-lg shadow-purple-950/30"
                    : isToday
                    ? "border-purple-500/30 bg-zinc-900"
                    : "border-zinc-800 bg-zinc-900 hover:border-purple-500/60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-lg font-bold ${isToday ? "text-purple-300" : "text-white"}`}>
                    {date.getDate()}
                  </span>

                  {summary.count > 0 && (
                    <span className="rounded-full bg-purple-600 px-2 py-0.5 text-xs">
                      {summary.count}
                    </span>
                  )}
                </div>

                {summary.count > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-zinc-400">
                      {money.format(summary.total)}
                    </p>

                    <div className="flex flex-wrap gap-1">
                      {summary.pending > 0 && (
                        <span className="rounded-full bg-yellow-500/20 text-yellow-200 px-2 py-0.5 text-[10px]">
                          {summary.pending} pend.
                        </span>
                      )}

                      {summary.paid > 0 && (
                        <span className="rounded-full bg-emerald-500/20 text-emerald-200 px-2 py-0.5 text-[10px]">
                          {summary.paid} pago
                        </span>
                      )}

                      {summary.late > 0 && (
                        <span className="rounded-full bg-red-500/20 text-red-200 px-2 py-0.5 text-[10px]">
                          {summary.late} atraso
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 h-fit sticky top-6">
        <div className="mb-5">
          <h2 className="text-xl font-bold">{formatDateBR(selectedDate)}</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Pendências e pagamentos desse dia.
          </p>
        </div>

        <div className="space-y-3">
          {selectedEvents.map(renderPaymentCard)}

          {selectedEvents.length === 0 && (
            <div className="text-center text-zinc-500 py-12">
              Nenhuma pendência nesse dia.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
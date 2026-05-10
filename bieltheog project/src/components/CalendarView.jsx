import { useMemo, useState } from "react";
import { money, formatDateBR } from "../utils/helpers";
import { paymentStatuses } from "../utils/calculations";

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

function statusStyle(status) {
  if (status === paymentStatuses.PAID) {
    return "border-emerald-500/30 bg-emerald-950/20";
  }

  if (status === paymentStatuses.LATE) {
    return "border-red-500/30 bg-red-950/20";
  }

  if (status === paymentStatuses.PARTIAL) {
    return "border-blue-500/30 bg-blue-950/20";
  }

  if (status === paymentStatuses.RENEGOTIATED) {
    return "border-purple-500/30 bg-purple-950/20";
  }

  if (status === paymentStatuses.CANCELED) {
    return "border-zinc-700 bg-zinc-900/40 opacity-70";
  }

  return "border-zinc-800 bg-zinc-900";
}

function statusBadge(status) {
  if (status === paymentStatuses.PAID) {
    return "bg-emerald-500/20 text-emerald-200";
  }

  if (status === paymentStatuses.LATE) {
    return "bg-red-500/20 text-red-200";
  }

  if (status === paymentStatuses.PARTIAL) {
    return "bg-blue-500/20 text-blue-200";
  }

  if (status === paymentStatuses.RENEGOTIATED) {
    return "bg-purple-500/20 text-purple-200";
  }

  if (status === paymentStatuses.CANCELED) {
    return "bg-zinc-500/20 text-zinc-300";
  }

  return "bg-yellow-500/20 text-yellow-200";
}

export default function CalendarView({
  calendarEvents,
  onMarkPaymentPaid,
  onMarkPaymentLate,
  onMarkPaymentPartial,
  onMarkPaymentCanceled,
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(toISODate(new Date()));
  const [fineInput, setFineInput] = useState({});
  const [partialInput, setPartialInput] = useState({});
  const [noteInput, setNoteInput] = useState({});
  const [openAdvanced, setOpenAdvanced] = useState({});

  const monthDays = useMemo(() => getMonthDays(currentMonth), [currentMonth]);
  const groupedEvents = useMemo(
    () => groupEventsByDate(calendarEvents),
    [calendarEvents]
  );

  const selectedEvents = groupedEvents[selectedDate] || [];
  const today = toISODate(new Date());

  const mobileMonthEvents = useMemo(() => {
    const month = currentMonth.getMonth();
    const year = currentMonth.getFullYear();

    return Object.entries(groupedEvents)
      .filter(([date]) => {
        const itemDate = new Date(`${date}T00:00:00`);
        return itemDate.getMonth() === month && itemDate.getFullYear() === year;
      })
      .map(([date, events]) => ({
        date,
        events,
        total: events.reduce((sum, event) => sum + Number(event.valor || 0), 0),
        pending: events.filter(
          (event) => event.statusPagamento === paymentStatuses.PENDING
        ).length,
        paid: events.filter(
          (event) => event.statusPagamento === paymentStatuses.PAID
        ).length,
        late: events.filter(
          (event) => event.statusPagamento === paymentStatuses.LATE
        ).length,
        partial: events.filter(
          (event) => event.statusPagamento === paymentStatuses.PARTIAL
        ).length,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [groupedEvents, currentMonth]);

  function previousMonth() {
    setCurrentMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
    );
  }

  function nextMonth() {
    setCurrentMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    );
  }

  function getDaySummary(dateString) {
    const events = groupedEvents[dateString] || [];

    const total = events.reduce((sum, event) => sum + Number(event.valor || 0), 0);

    const paid = events.filter(
      (event) => event.statusPagamento === paymentStatuses.PAID
    ).length;

    const late = events.filter(
      (event) => event.statusPagamento === paymentStatuses.LATE
    ).length;

    const pending = events.filter(
      (event) => event.statusPagamento === paymentStatuses.PENDING
    ).length;

    const partial = events.filter(
      (event) => event.statusPagamento === paymentStatuses.PARTIAL
    ).length;

    return {
      count: events.length,
      total,
      paid,
      late,
      pending,
      partial,
    };
  }

  function getEventKey(event) {
    return event.paymentKey || event.eventKey || event.id || event.date;
  }

  function toggleAdvanced(eventId) {
    setOpenAdvanced((prev) => ({
      ...prev,
      [eventId]: !prev[eventId],
    }));
  }

  function renderPaymentCard(event) {
    const eventKey = getEventKey(event);

    const fineValue =
      fineInput[event.id] ?? event.multaPercentual ?? 0;

    const partialValue =
      partialInput[event.id] ?? event.valorPago ?? "";

    const noteValue =
      noteInput[event.id] ?? event.observacao ?? "";

    const isAdvancedOpen = openAdvanced[event.id];

    return (
      <div
        key={event.id}
        className={`rounded-2xl border p-4 ${statusStyle(event.statusPagamento)}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold break-words">{event.nome}</p>

            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span
                className={`rounded-full px-2 py-1 text-xs ${statusBadge(
                  event.statusPagamento
                )}`}
              >
                {event.statusPagamento}
              </span>

              <span className="text-xs text-zinc-500">
                {event.tipo}
              </span>
            </div>

            {event.descricao && (
              <p className="text-xs text-zinc-400 mt-2">
                {event.descricao}
              </p>
            )}

            {event.observacao && (
              <p className="text-xs text-zinc-400 mt-2">
                Obs: {event.observacao}
              </p>
            )}
          </div>

          <div className="text-right shrink-0">
            <p className="font-bold text-purple-200">
              {money.format(event.valor)}
            </p>

            {event.valorPago > 0 && (
              <p className="text-xs text-blue-200">
                Pago: {money.format(event.valorPago)}
              </p>
            )}

            {event.statusPagamento === paymentStatuses.LATE && (
              <p className="text-xs text-red-200">
                Multa {event.multaPercentual || 0}%
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2">
          <button
            type="button"
            onClick={() => onMarkPaymentPaid(event.recordId, eventKey)}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-3 md:py-2 text-sm font-semibold transition"
          >
            Marcar como pago
          </button>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
              className="rounded-xl bg-black border border-zinc-800 px-3 py-3 md:py-2 text-sm outline-none focus:border-red-500"
            />

            <button
              type="button"
              onClick={() =>
                onMarkPaymentLate(event.recordId, eventKey, fineValue)
              }
              className="rounded-xl bg-red-600 hover:bg-red-700 px-4 py-3 md:py-2 text-sm font-semibold transition"
            >
              Marcar atraso
            </button>
          </div>

          <button
            type="button"
            onClick={() => toggleAdvanced(event.id)}
            className="rounded-xl border border-zinc-700 bg-black/30 px-4 py-3 md:py-2 text-sm font-semibold text-zinc-300 hover:text-white hover:border-purple-500 transition"
          >
            {isAdvancedOpen ? "Fechar opções" : "Opções avançadas"}
          </button>

          {isAdvancedOpen && (
            <div className="rounded-2xl border border-zinc-800 bg-black/30 p-3 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={partialValue}
                  onChange={(e) =>
                    setPartialInput((prev) => ({
                      ...prev,
                      [event.id]: e.target.value,
                    }))
                  }
                  placeholder="Valor pago parcial"
                  className="rounded-xl bg-black border border-zinc-800 px-3 py-3 md:py-2 text-sm outline-none focus:border-blue-500"
                />

                <button
                  type="button"
                  onClick={() =>
                    onMarkPaymentPartial(
                      event.recordId,
                      eventKey,
                      partialValue,
                      noteValue
                    )
                  }
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-3 md:py-2 text-sm font-semibold transition"
                >
                  Marcar parcial
                </button>
              </div>

              <textarea
                value={noteValue}
                onChange={(e) =>
                  setNoteInput((prev) => ({
                    ...prev,
                    [event.id]: e.target.value,
                  }))
                }
                placeholder="Observação da parcela"
                className="w-full min-h-[80px] rounded-xl bg-black border border-zinc-800 px-3 py-3 text-sm outline-none focus:border-purple-500"
              />

              <button
                type="button"
                onClick={() =>
                  onMarkPaymentCanceled(event.recordId, eventKey, noteValue)
                }
                className="w-full rounded-xl bg-zinc-700 hover:bg-zinc-600 px-4 py-3 md:py-2 text-sm font-semibold transition"
              >
                Cancelar parcela
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6">
      <div className="xl:col-span-2 rounded-3xl border border-zinc-800 bg-zinc-950 p-4 md:p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
          <div>
            <h2 className="text-xl md:text-2xl font-bold">
              Calendário de pagamentos
            </h2>
            <p className="text-sm text-zinc-500 mt-1">
              No celular, os dias com pagamentos aparecem em lista.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={previousMonth}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 md:py-2 hover:border-purple-500 transition"
            >
              ←
            </button>

            <div className="flex-1 md:flex-none min-w-0 md:min-w-44 text-center rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 md:py-2 font-semibold capitalize text-sm md:text-base">
              {getMonthName(currentMonth)}
            </div>

            <button
              onClick={nextMonth}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 md:py-2 hover:border-purple-500 transition"
            >
              →
            </button>
          </div>
        </div>

        <div className="md:hidden space-y-3">
          {mobileMonthEvents.map((group) => {
            const isSelected = selectedDate === group.date;
            const isToday = group.date === today;

            return (
              <button
                key={group.date}
                type="button"
                onClick={() => setSelectedDate(group.date)}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  isSelected
                    ? "border-purple-500 bg-purple-600/20"
                    : isToday
                    ? "border-purple-500/40 bg-zinc-900"
                    : "border-zinc-800 bg-zinc-900"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold">{formatDateBR(group.date)}</p>
                    <p className="text-sm text-zinc-500">
                      {group.events.length} pagamento(s)
                    </p>
                  </div>

                  <strong className="text-purple-200">
                    {money.format(group.total)}
                  </strong>
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  {group.pending > 0 && (
                    <span className="rounded-full bg-yellow-500/20 text-yellow-200 px-2 py-1 text-xs">
                      {group.pending} pend.
                    </span>
                  )}

                  {group.partial > 0 && (
                    <span className="rounded-full bg-blue-500/20 text-blue-200 px-2 py-1 text-xs">
                      {group.partial} parcial
                    </span>
                  )}

                  {group.paid > 0 && (
                    <span className="rounded-full bg-emerald-500/20 text-emerald-200 px-2 py-1 text-xs">
                      {group.paid} pago
                    </span>
                  )}

                  {group.late > 0 && (
                    <span className="rounded-full bg-red-500/20 text-red-200 px-2 py-1 text-xs">
                      {group.late} atraso
                    </span>
                  )}
                </div>
              </button>
            );
          })}

          {mobileMonthEvents.length === 0 && (
            <div className="text-center text-zinc-500 py-12">
              Nenhum pagamento neste mês.
            </div>
          )}
        </div>

        <div className="hidden md:block">
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
                    <span
                      className={`text-lg font-bold ${
                        isToday ? "text-purple-300" : "text-white"
                      }`}
                    >
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

                        {summary.partial > 0 && (
                          <span className="rounded-full bg-blue-500/20 text-blue-200 px-2 py-0.5 text-[10px]">
                            {summary.partial} parcial
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
      </div>

      <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-4 md:p-5 h-fit xl:sticky xl:top-6">
        <div className="mb-5">
          <h2 className="text-lg md:text-xl font-bold">
            {formatDateBR(selectedDate)}
          </h2>
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
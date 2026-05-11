import { useMemo, useState } from "react";
import { money, formatDateBR } from "../utils/helpers";
import { paymentStatuses } from "../utils/calculations";

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

function getMonthName(date) {
  return date.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

function getMonthDays(baseDate) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const days = [];

  for (let i = 0; i < firstDay.getDay(); i++) {
    days.push(null);
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    days.push(new Date(year, month, day));
  }

  return days;
}

function groupEventsByDate(events = []) {
  return events.reduce((groups, event) => {
    if (!groups[event.date]) groups[event.date] = [];
    groups[event.date].push(event);
    return groups;
  }, {});
}

function getStatusLabel(status) {
  if (status === paymentStatuses.PAID) return "Pago";
  if (status === paymentStatuses.LATE) return "Atrasado";
  if (status === paymentStatuses.PARTIAL) return "Parcial";
  if (status === paymentStatuses.CANCELED) return "Cancelado";
  return "Pendente";
}

function getStatusClasses(status) {
  if (status === paymentStatuses.PAID) {
    return {
      card: "border-emerald-500/25 bg-emerald-500/8",
      badge: "border-emerald-500/25 bg-emerald-500/12 text-emerald-300",
      dot: "bg-emerald-400",
    };
  }

  if (status === paymentStatuses.LATE) {
    return {
      card: "border-rose-500/25 bg-rose-500/8",
      badge: "border-rose-500/25 bg-rose-500/12 text-rose-300",
      dot: "bg-rose-400",
    };
  }

  if (status === paymentStatuses.PARTIAL) {
    return {
      card: "border-cyan-500/25 bg-cyan-500/8",
      badge: "border-cyan-500/25 bg-cyan-500/12 text-cyan-300",
      dot: "bg-cyan-400",
    };
  }

  if (status === paymentStatuses.CANCELED) {
    return {
      card: "border-slate-600/25 bg-slate-600/8 opacity-70",
      badge: "border-slate-500/25 bg-slate-500/12 text-slate-300",
      dot: "bg-slate-400",
    };
  }

  return {
    card: "border-orange-500/20 bg-orange-500/8",
    badge: "border-orange-500/25 bg-orange-500/12 text-orange-300",
    dot: "bg-orange-400",
  };
}

function getEventKey(event) {
  return event.paymentKey || event.eventKey || event.id || event.date;
}

function summarizeEvents(events = []) {
  return {
    total: events.reduce((sum, event) => sum + Number(event.valor || 0), 0),
    count: events.length,
    paid: events.filter((event) => event.statusPagamento === paymentStatuses.PAID).length,
    pending: events.filter((event) => event.statusPagamento === paymentStatuses.PENDING).length,
    late: events.filter((event) => event.statusPagamento === paymentStatuses.LATE).length,
    partial: events.filter((event) => event.statusPagamento === paymentStatuses.PARTIAL).length,
    canceled: events.filter((event) => event.statusPagamento === paymentStatuses.CANCELED).length,
  };
}

function MiniSummary({ label, value, tone }) {
  const tones = {
    purple: "text-purple-300 bg-purple-500/10 border-purple-500/20",
    green: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
    orange: "text-orange-300 bg-orange-500/10 border-orange-500/20",
    rose: "text-rose-300 bg-rose-500/10 border-rose-500/20",
    cyan: "text-cyan-300 bg-cyan-500/10 border-cyan-500/20",
  };

  return (
    <div className={`rounded-xl border p-3 ${tones[tone] || tones.purple}`}>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
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

  const today = toISODate(new Date());

  const monthDays = useMemo(() => getMonthDays(currentMonth), [currentMonth]);

  const groupedEvents = useMemo(
    () => groupEventsByDate(calendarEvents || []),
    [calendarEvents]
  );

  const selectedEvents = groupedEvents[selectedDate] || [];
  const selectedSummary = summarizeEvents(selectedEvents);

  const monthEvents = useMemo(() => {
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
        ...summarizeEvents(events),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [groupedEvents, currentMonth]);

  const monthSummary = useMemo(() => {
    const events = monthEvents.flatMap((item) => item.events);
    return summarizeEvents(events);
  }, [monthEvents]);

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

  function goToday() {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(toISODate(now));
  }

  function getDaySummary(dateString) {
    return summarizeEvents(groupedEvents[dateString] || []);
  }

  function toggleAdvanced(eventId) {
    setOpenAdvanced((prev) => ({
      ...prev,
      [eventId]: !prev[eventId],
    }));
  }

  function renderPaymentCard(event) {
    const eventKey = getEventKey(event);
    const statusClasses = getStatusClasses(event.statusPagamento);

    const fineValue = fineInput[event.id] ?? event.multaPercentual ?? 0;
    const partialValue = partialInput[event.id] ?? event.valorPago ?? "";
    const noteValue = noteInput[event.id] ?? event.observacao ?? "";
    const isAdvancedOpen = openAdvanced[event.id];

    return (
      <div
        key={event.id}
        className={`rounded-2xl border p-4 ${statusClasses.card}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">
              {event.nome}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses.badge}`}
              >
                {getStatusLabel(event.statusPagamento)}
              </span>

              <span className="text-xs text-slate-500">{event.tipo}</span>
            </div>

            {event.descricao && (
              <p className="mt-2 text-xs text-slate-400">{event.descricao}</p>
            )}

            {event.observacao && (
              <p className="mt-2 text-xs text-slate-400">
                Obs: {event.observacao}
              </p>
            )}
          </div>

          <div className="shrink-0 text-right">
            <p className="text-base font-bold text-white">
              {money.format(event.valor)}
            </p>

            {Number(event.valorPago || 0) > 0 && (
              <p className="text-xs text-cyan-300">
                Pago: {money.format(event.valorPago)}
              </p>
            )}

            {event.statusPagamento === paymentStatuses.LATE && (
              <p className="text-xs text-rose-300">
                Multa {event.multaPercentual || 0}%
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2">
          <button
            type="button"
            onClick={() => onMarkPaymentPaid(event.recordId, eventKey)}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700"
          >
            Marcar como pago
          </button>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr]">
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
              className="input-dark rounded-xl px-3 py-2.5 text-sm outline-none"
            />

            <button
              type="button"
              onClick={() =>
                onMarkPaymentLate(event.recordId, eventKey, fineValue)
              }
              className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-rose-700"
            >
              Marcar atraso
            </button>
          </div>

          <button
            type="button"
            onClick={() => toggleAdvanced(event.id)}
            className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-white/[0.07] hover:text-white"
          >
            {isAdvancedOpen ? "Fechar opções" : "Opções avançadas"}
          </button>

          {isAdvancedOpen && (
            <div className="rounded-xl border border-white/[0.08] bg-[#090e1c] p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr]">
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
                  className="input-dark rounded-xl px-3 py-2.5 text-sm outline-none"
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
                  className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-cyan-700"
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
                className="input-dark mt-2 min-h-[84px] w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              />

              <button
                type="button"
                onClick={() =>
                  onMarkPaymentCanceled(event.recordId, eventKey, noteValue)
                }
                className="mt-2 w-full rounded-xl bg-slate-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-600"
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
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.45fr_0.75fr]">
      <div className="space-y-4">
        <div className="card-dark rounded-2xl p-4">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <h2 className="text-xl font-bold text-white">
                Calendário de pagamentos
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Selecione um dia para ver, pagar, atrasar ou editar parcelas.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={previousMonth}
                className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-white/[0.07]"
              >
                ←
              </button>

              <div className="min-w-[180px] rounded-xl border border-white/[0.08] bg-[#0a0f1f] px-4 py-2.5 text-center text-sm font-bold capitalize text-white">
                {getMonthName(currentMonth)}
              </div>

              <button
                onClick={nextMonth}
                className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-white/[0.07]"
              >
                →
              </button>

              <button
                onClick={goToday}
                className="rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-purple-700"
              >
                Hoje
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <MiniSummary
            label="Total do mês"
            value={money.format(monthSummary.total)}
            tone="purple"
          />

          <MiniSummary
            label="Pagas"
            value={monthSummary.paid}
            tone="green"
          />

          <MiniSummary
            label="Pendentes"
            value={monthSummary.pending}
            tone="orange"
          />

          <MiniSummary
            label="Atrasadas"
            value={monthSummary.late}
            tone="rose"
          />

          <MiniSummary
            label="Parciais"
            value={monthSummary.partial}
            tone="cyan"
          />
        </div>

        <div className="card-dark rounded-2xl p-4">
          {/* Mobile list */}
          <div className="space-y-3 md:hidden">
            {monthEvents.map((day) => {
              const isSelected = selectedDate === day.date;
              const isToday = day.date === today;

              return (
                <button
                  key={day.date}
                  onClick={() => setSelectedDate(day.date)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    isSelected
                      ? "border-purple-500/50 bg-purple-500/12"
                      : isToday
                      ? "border-cyan-500/35 bg-cyan-500/8"
                      : "border-white/[0.08] bg-white/[0.03]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">
                        {formatDateBR(day.date)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {day.count} parcela(s)
                      </p>
                    </div>

                    <strong className="text-sm text-purple-300">
                      {money.format(day.total)}
                    </strong>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {day.pending > 0 && (
                      <span className="rounded-full bg-orange-500/12 px-2 py-1 text-xs text-orange-300">
                        {day.pending} pend.
                      </span>
                    )}

                    {day.paid > 0 && (
                      <span className="rounded-full bg-emerald-500/12 px-2 py-1 text-xs text-emerald-300">
                        {day.paid} pago
                      </span>
                    )}

                    {day.late > 0 && (
                      <span className="rounded-full bg-rose-500/12 px-2 py-1 text-xs text-rose-300">
                        {day.late} atraso
                      </span>
                    )}

                    {day.partial > 0 && (
                      <span className="rounded-full bg-cyan-500/12 px-2 py-1 text-xs text-cyan-300">
                        {day.partial} parcial
                      </span>
                    )}
                  </div>
                </button>
              );
            })}

            {monthEvents.length === 0 && (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 text-center text-sm text-slate-500">
                Nenhum pagamento neste mês.
              </div>
            )}
          </div>

          {/* Desktop calendar */}
          <div className="hidden md:block">
            <div className="mb-3 grid grid-cols-7 gap-2 text-center text-xs font-bold text-slate-500">
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
                      className="min-h-[105px] rounded-xl border border-transparent"
                    />
                  );
                }

                const dateString = toISODate(date);
                const summary = getDaySummary(dateString);
                const isSelected = selectedDate === dateString;
                const isToday = today === dateString;

                return (
                  <button
                    key={dateString}
                    onClick={() => setSelectedDate(dateString)}
                    className={`min-h-[105px] rounded-xl border p-3 text-left transition hover:border-purple-500/40 ${
                      isSelected
                        ? "border-purple-500/50 bg-purple-500/12"
                        : isToday
                        ? "border-cyan-500/35 bg-cyan-500/8"
                        : "border-white/[0.08] bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-sm font-bold ${
                          isToday ? "text-cyan-300" : "text-white"
                        }`}
                      >
                        {date.getDate()}
                      </span>

                      {summary.count > 0 && (
                        <span className="rounded-full bg-purple-600 px-2 py-0.5 text-xs font-bold text-white">
                          {summary.count}
                        </span>
                      )}
                    </div>

                    {summary.count > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-semibold text-slate-400">
                          {money.format(summary.total)}
                        </p>

                        <div className="flex flex-wrap gap-1">
                          {summary.paid > 0 && (
                            <span className="h-2 w-2 rounded-full bg-emerald-400" />
                          )}
                          {summary.pending > 0 && (
                            <span className="h-2 w-2 rounded-full bg-orange-400" />
                          )}
                          {summary.late > 0 && (
                            <span className="h-2 w-2 rounded-full bg-rose-400" />
                          )}
                          {summary.partial > 0 && (
                            <span className="h-2 w-2 rounded-full bg-cyan-400" />
                          )}
                        </div>

                        <div className="text-[10px] text-slate-500">
                          {summary.pending > 0 && `${summary.pending} pend. `}
                          {summary.late > 0 && `${summary.late} atraso `}
                          {summary.partial > 0 && `${summary.partial} parcial`}
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <aside className="card-dark h-fit rounded-2xl p-4 xl:sticky xl:top-5">
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-purple-300">
            Dia selecionado
          </p>

          <h3 className="mt-2 text-xl font-bold text-white">
            {formatDateBR(selectedDate)}
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            {selectedSummary.count} parcela(s) neste dia.
          </p>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <MiniSummary
            label="Total"
            value={money.format(selectedSummary.total)}
            tone="purple"
          />

          <MiniSummary
            label="Atrasos"
            value={selectedSummary.late}
            tone="rose"
          />
        </div>

        <div className="space-y-3">
          {selectedEvents.map(renderPaymentCard)}

          {selectedEvents.length === 0 && (
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 text-center">
              <p className="text-sm font-semibold text-white">
                Sem pendências
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Não existem pagamentos cadastrados para este dia.
              </p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
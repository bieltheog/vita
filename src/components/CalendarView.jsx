import { useMemo, useState } from "react";
import { money, formatDateBR } from "../utils/helpers";
import { paymentStatuses } from "../utils/calculations";

function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

function parseISODate(dateString) {
  if (!dateString) return null;

  const [year, month, day] = String(dateString).split("-").map(Number);

  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
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

function normalizeEvent(event) {
  const status = event.statusPagamento || paymentStatuses.PENDING;

  const isSettled =
    status === paymentStatuses.PAID ||
    status === paymentStatuses.CANCELED;

  const name = event.nome || event.clientName || event.nomeCliente || "Cliente";

  const baseValue = Number(
    event.saldo ??
      event.remainingAmount ??
      event.valorComMulta ??
      event.totalWithFine ??
      event.valor ??
      event.amount ??
      0
  );

  const paidValue = Number(event.valorPago ?? event.amountPaid ?? 0);

  const originalValue = Number(
    event.valorOriginal ?? event.originalAmount ?? event.valor ?? event.amount ?? 0
  );

  const displayValue = isSettled ? 0 : Math.max(0, baseValue);

  const paymentKey = event.paymentKey || event.eventKey || event.id;

  return {
    ...event,
    name,
    status,
    isSettled,
    displayValue,
    paidValue,
    originalValue,
    paymentKey,
  };
}

function groupEventsByDate(events = []) {
  return events.reduce((groups, rawEvent) => {
    const event = normalizeEvent(rawEvent);

    if (!groups[event.date]) groups[event.date] = [];

    groups[event.date].push(event);

    return groups;
  }, {});
}

function getUnresolvedEvents(events = []) {
  return events.filter((event) => !event.isSettled);
}

function getSettledEvents(events = []) {
  return events.filter((event) => event.isSettled);
}

function summarizeEvents(events = []) {
  const unresolved = getUnresolvedEvents(events);

  return {
    total: unresolved.reduce((sum, event) => sum + Number(event.displayValue || 0), 0),
    count: unresolved.length,
    allCount: events.length,
    paid: events.filter((event) => event.status === paymentStatuses.PAID).length,
    pending: events.filter((event) => event.status === paymentStatuses.PENDING).length,
    late: events.filter((event) => event.status === paymentStatuses.LATE).length,
    partial: events.filter((event) => event.status === paymentStatuses.PARTIAL).length,
    canceled: events.filter((event) => event.status === paymentStatuses.CANCELED).length,
  };
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
      card: "border-emerald-500/20 bg-emerald-500/10",
      badge: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
      dot: "bg-emerald-400",
    };
  }

  if (status === paymentStatuses.LATE) {
    return {
      card: "border-rose-500/20 bg-rose-500/10",
      badge: "border-rose-500/25 bg-rose-500/10 text-rose-300",
      dot: "bg-rose-400",
    };
  }

  if (status === paymentStatuses.PARTIAL) {
    return {
      card: "border-amber-500/20 bg-amber-500/10",
      badge: "border-amber-500/25 bg-amber-500/10 text-amber-300",
      dot: "bg-amber-400",
    };
  }

  if (status === paymentStatuses.CANCELED) {
    return {
      card: "border-slate-500/20 bg-slate-500/10 opacity-70",
      badge: "border-slate-500/25 bg-slate-500/10 text-slate-300",
      dot: "bg-slate-400",
    };
  }

  return {
    card: "border-orange-500/20 bg-orange-500/10",
    badge: "border-orange-500/25 bg-orange-500/10 text-orange-300",
    dot: "bg-orange-400",
  };
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
}

function makeReminderMessage(event) {
  const date = formatDateBR(event.date);

  return `Olá, ${event.name}! Passando para lembrar que sua parcela de ${money.format(
    event.displayValue || event.originalValue || 0
  )} vence em ${date}.`;
}

function makeLateMessage(event) {
  const date = formatDateBR(event.date);

  return `Olá, ${event.name}! Sua parcela de ${money.format(
    event.displayValue || event.originalValue || 0
  )} venceu em ${date}. Pode regularizar por favor?`;
}

function SummaryCard({ label, value, tone = "orange" }) {
  const tones = {
    orange: "border-orange-500/20 bg-orange-500/10 text-orange-300",
    green: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    red: "border-rose-500/20 bg-rose-500/10 text-rose-300",
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    slate: "border-white/[0.08] bg-white/[0.03] text-slate-300",
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] || tones.orange}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-bold">{value}</p>
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

  const normalizedEvents = useMemo(
    () => (calendarEvents || []).map(normalizeEvent),
    [calendarEvents]
  );

  const monthDays = useMemo(() => getMonthDays(currentMonth), [currentMonth]);

  const groupedEvents = useMemo(
    () => groupEventsByDate(normalizedEvents),
    [normalizedEvents]
  );

  const selectedEvents = groupedEvents[selectedDate] || [];
  const selectedUnresolved = getUnresolvedEvents(selectedEvents);
  const selectedSettled = getSettledEvents(selectedEvents);
  const selectedSummary = summarizeEvents(selectedEvents);

  const monthEvents = useMemo(() => {
    const month = currentMonth.getMonth();
    const year = currentMonth.getFullYear();

    return Object.entries(groupedEvents)
      .filter(([date]) => {
        const itemDate = parseISODate(date);
        if (!itemDate) return false;

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

  function handleCopyReminder(event) {
    copyToClipboard(makeReminderMessage(event));
    alert("Mensagem de cobrança copiada.");
  }

  function handleCopyLate(event) {
    copyToClipboard(makeLateMessage(event));
    alert("Mensagem de atraso copiada.");
  }

  function renderPaymentCard(event) {
    const statusClasses = getStatusClasses(event.status);

    const fineValue = fineInput[event.id] ?? event.multaPercentual ?? 0;
    const partialValue = partialInput[event.id] ?? event.paidValue ?? "";
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
              {event.name}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses.badge}`}
              >
                {getStatusLabel(event.status)}
              </span>

              <span className="text-xs text-slate-500">
                {event.tipo || event.typeLabel || event.descricao || "Parcela"}
              </span>
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
              {money.format(event.displayValue || event.originalValue || 0)}
            </p>

            {Number(event.paidValue || 0) > 0 && (
              <p className="text-xs text-amber-300">
                Pago: {money.format(event.paidValue)}
              </p>
            )}

            {event.status === paymentStatuses.LATE && (
              <p className="text-xs text-rose-300">
                Multa {event.multaPercentual || 0}%
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2">
          <button
            type="button"
            onClick={() => onMarkPaymentPaid(event.recordId, event.paymentKey)}
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
                onMarkPaymentLate(event.recordId, event.paymentKey, fineValue)
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
            <div className="rounded-xl border border-white/[0.08] bg-[#0d1016] p-3">
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
                      event.paymentKey,
                      partialValue,
                      noteValue
                    )
                  }
                  className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-amber-600"
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

              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => handleCopyReminder(event)}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
                >
                  Copiar cobrança
                </button>

                <button
                  type="button"
                  onClick={() => handleCopyLate(event)}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
                >
                  Copiar atraso
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onMarkPaymentCanceled(event.recordId, event.paymentKey, noteValue)
                  }
                  className="rounded-xl bg-slate-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-600"
                >
                  Cancelar
                </button>
              </div>
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
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-300">
                Calendário
              </p>

              <h2 className="mt-2 text-xl font-bold text-white">
                Calendário de recebimentos
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Selecione um dia para ver, pagar, atrasar ou editar parcelas.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={previousMonth}
                className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-white/[0.07]"
              >
                ←
              </button>

              <div className="min-w-[180px] rounded-xl border border-white/[0.08] bg-[#0d1016] px-4 py-2.5 text-center text-sm font-bold capitalize text-white">
                {getMonthName(currentMonth)}
              </div>

              <button
                type="button"
                onClick={nextMonth}
                className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-white/[0.07]"
              >
                →
              </button>

              <button
                type="button"
                onClick={goToday}
                className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-orange-600"
              >
                Hoje
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <SummaryCard
            label="Aberto no mês"
            value={money.format(monthSummary.total)}
            tone="orange"
          />

          <SummaryCard
            label="Pagas"
            value={monthSummary.paid}
            tone="green"
          />

          <SummaryCard
            label="Pendentes"
            value={monthSummary.pending}
            tone="amber"
          />

          <SummaryCard
            label="Atrasadas"
            value={monthSummary.late}
            tone="red"
          />

          <SummaryCard
            label="Parciais"
            value={monthSummary.partial}
            tone="slate"
          />
        </div>

        <div className="card-dark rounded-2xl p-4">
          <div className="space-y-3 md:hidden">
            {monthEvents.map((day) => {
              const isSelected = selectedDate === day.date;
              const isToday = day.date === today;

              if (day.count <= 0) return null;

              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDate(day.date)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    isSelected
                      ? "border-orange-500/50 bg-orange-500/12"
                      : isToday
                      ? "border-amber-500/35 bg-amber-500/8"
                      : "border-white/[0.08] bg-white/[0.03]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-white">
                        {formatDateBR(day.date)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {day.count} pendência(s)
                      </p>
                    </div>

                    <strong className="text-sm text-orange-300">
                      {money.format(day.total)}
                    </strong>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {day.pending > 0 && (
                      <span className="rounded-full bg-orange-500/12 px-2 py-1 text-xs text-orange-300">
                        {day.pending} pend.
                      </span>
                    )}

                    {day.late > 0 && (
                      <span className="rounded-full bg-rose-500/12 px-2 py-1 text-xs text-rose-300">
                        {day.late} atraso
                      </span>
                    )}

                    {day.partial > 0 && (
                      <span className="rounded-full bg-amber-500/12 px-2 py-1 text-xs text-amber-300">
                        {day.partial} parcial
                      </span>
                    )}
                  </div>
                </button>
              );
            })}

            {monthEvents.filter((day) => day.count > 0).length === 0 && (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 text-center text-sm text-slate-500">
                Nenhuma pendência neste mês.
              </div>
            )}
          </div>

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

                const hasOpenItems = summary.count > 0;

                return (
                  <button
                    key={dateString}
                    type="button"
                    onClick={() => setSelectedDate(dateString)}
                    className={`min-h-[105px] rounded-xl border p-3 text-left transition hover:border-orange-500/40 ${
                      isSelected
                        ? "border-orange-500/50 bg-orange-500/12"
                        : isToday
                        ? "border-amber-500/35 bg-amber-500/8"
                        : "border-white/[0.08] bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-sm font-bold ${
                          isToday ? "text-amber-300" : "text-white"
                        }`}
                      >
                        {date.getDate()}
                      </span>

                      {hasOpenItems && (
                        <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-orange-500 px-2 text-xs font-bold text-white">
                          {summary.count}
                        </span>
                      )}
                    </div>

                    {hasOpenItems && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-semibold text-slate-400">
                          {money.format(summary.total)}
                        </p>

                        <div className="flex flex-wrap gap-1">
                          {summary.pending > 0 && (
                            <span className="h-2 w-2 rounded-full bg-orange-400" />
                          )}

                          {summary.late > 0 && (
                            <span className="h-2 w-2 rounded-full bg-rose-400" />
                          )}

                          {summary.partial > 0 && (
                            <span className="h-2 w-2 rounded-full bg-amber-400" />
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
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-300">
            Dia selecionado
          </p>

          <h3 className="mt-2 text-xl font-bold text-white">
            {formatDateBR(selectedDate)}
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            {selectedSummary.count} pendência(s) aberta(s).
          </p>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <SummaryCard
            label="Aberto"
            value={money.format(selectedSummary.total)}
            tone="orange"
          />

          <SummaryCard
            label="Atrasos"
            value={selectedSummary.late}
            tone="red"
          />
        </div>

        <div className="space-y-3">
          {selectedUnresolved.map(renderPaymentCard)}

          {selectedUnresolved.length === 0 && (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-8 text-center">
              <p className="text-sm font-semibold text-emerald-300">
                Sem pendências
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Não existem cobranças abertas para este dia.
              </p>
            </div>
          )}
        </div>

        {selectedSettled.length > 0 && (
          <div className="mt-5">
            <p className="mb-3 text-sm font-bold text-white">
              Concluídos no dia
            </p>

            <div className="space-y-2">
              {selectedSettled.map((event) => {
                const statusClasses = getStatusClasses(event.status);

                return (
                  <div
                    key={event.id}
                    className={`rounded-xl border p-3 ${statusClasses.card}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {event.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {getStatusLabel(event.status)}
                        </p>
                      </div>

                      <p className="text-sm font-bold text-white">
                        {money.format(event.originalValue || event.valor || 0)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
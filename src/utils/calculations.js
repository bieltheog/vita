export const paymentTypes = {
  DAILY: "Diário",
  WEEKLY: "Semanal",
  FIXED_DATES: "Datas Fixas",
  CUSTOM: "Personalizado",
};

export const paymentStatuses = {
  PENDING: "Pendente",
  PAID: "Pago",
  LATE: "Atrasado",
  PARTIAL: "Parcial",
  CANCELED: "Cancelado",
};

export const emptyForm = {
  nome: "",
  whatsapp: "",
  cpf: "",
  cep: "",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
  abrirConta: true,
  valorEnviado: "",
  porcentagemRetorno: "",
  frequencia: paymentTypes.DAILY,
  dataInicio: "",
  dataTermino: "",
  semanas: "4",
  diaPagamento: "5",
  diasPagamentoFixos: ["15", "30"],
  parcelasPersonalizadas: [],
  multaPercentual: "0",
  status: "Ativo",
  observacao: "",
  extrato: null,
  comprovanteResidencia: null,
  identidade: null,
  outros: null,
};

export function toNumber(value) {
  if (value === null || value === undefined || value === "") return 0;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const normalized = String(value)
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();

  const number = Number(normalized);

  return Number.isFinite(number) ? number : 0;
}

export function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

export function calculateReceivable(valorEnviado, porcentagemRetorno) {
  const enviado = toNumber(valorEnviado);
  const retorno = toNumber(porcentagemRetorno);

  return roundMoney(enviado + (enviado * retorno) / 100);
}

export function normalizePaymentType(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/_/g, " ")
    .replace(/-/g, " ");

  if (
    raw === "diario" ||
    raw === "daily" ||
    raw === "dia" ||
    raw === "todos os dias"
  ) {
    return paymentTypes.DAILY;
  }

  if (
    raw === "semanal" ||
    raw === "weekly" ||
    raw === "semana" ||
    raw === "por semana"
  ) {
    return paymentTypes.WEEKLY;
  }

  if (
    raw === "datas fixas" ||
    raw === "data fixa" ||
    raw === "fixed dates" ||
    raw === "fixed date" ||
    raw === "fixed dates" ||
    raw === "fixeddates" ||
    raw === "fixed dates" ||
    raw === "fixed" ||
    raw === "dias fixos" ||
    raw === "dia fixo"
  ) {
    return paymentTypes.FIXED_DATES;
  }

  if (
    raw === "personalizado" ||
    raw === "custom" ||
    raw === "parcelas personalizadas" ||
    raw === "parcela personalizada"
  ) {
    return paymentTypes.CUSTOM;
  }

  return value || paymentTypes.DAILY;
}

function parseISODate(dateString) {
  if (!dateString) return null;

  const [year, month, day] = String(dateString).split("-").map(Number);

  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
}

function toISODate(date) {
  if (!(date instanceof Date)) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(date, amount) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function isSunday(date) {
  return date.getDay() === 0;
}

function enumerateDates(start, end) {
  const dates = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function distributeAmounts(total, count) {
  if (count <= 0) return [];

  const base = roundMoney(total / count);
  const amounts = Array(count).fill(base);

  const currentTotal = roundMoney(amounts.reduce((sum, value) => sum + value, 0));
  const difference = roundMoney(total - currentTotal);

  amounts[amounts.length - 1] = roundMoney(
    amounts[amounts.length - 1] + difference
  );

  return amounts;
}

export function calculateInstallment(record) {
  if (!record || !record.abrirConta) return 0;

  const total = toNumber(record.valorReceber);

  if (total <= 0) return 0;

  const frequencia = normalizePaymentType(record.frequencia);

  if (frequencia === paymentTypes.CUSTOM) {
    return 0;
  }

  if (frequencia === paymentTypes.WEEKLY) {
    const semanas = Math.max(1, toNumber(record.semanas));
    return roundMoney(total / semanas);
  }

  const entries = buildRawEntries(record);

  if (entries.length <= 0) return 0;

  return roundMoney(total / entries.length);
}

export function calculateLateAmount(value, multaPercentual = 0) {
  const amount = toNumber(value);
  const fine = toNumber(multaPercentual);

  return roundMoney(amount + (amount * fine) / 100);
}

function buildDailyEntries(record) {
  const start = parseISODate(record.dataInicio);
  const end = parseISODate(record.dataTermino);

  if (!start || !end || end < start) return [];

  const validDates = enumerateDates(start, end).filter((date) => !isSunday(date));
  const amounts = distributeAmounts(toNumber(record.valorReceber), validDates.length);

  return validDates.map((date, index) => ({
    date: toISODate(date),
    amount: roundMoney(amounts[index] || 0),
    index,
    label: "Diária",
  }));
}

function buildWeeklyEntries(record) {
  const start = parseISODate(record.dataInicio);
  const weeks = Math.max(1, toNumber(record.semanas));
  const weekday = Number(record.diaPagamento ?? 5);

  if (!start) return [];

  let firstPayment = new Date(start);

  while (firstPayment.getDay() !== weekday) {
    firstPayment = addDays(firstPayment, 1);
  }

  const dates = [];

  for (let index = 0; index < weeks; index += 1) {
    dates.push(addDays(firstPayment, index * 7));
  }

  const amounts = distributeAmounts(toNumber(record.valorReceber), dates.length);

  return dates.map((date, index) => ({
    date: toISODate(date),
    amount: roundMoney(amounts[index] || 0),
    index,
    label: "Semanal",
  }));
}

function buildFixedDatesEntries(record) {
  const start = parseISODate(record.dataInicio);
  const end = parseISODate(record.dataTermino);

  if (!start || !end || end < start) return [];

  const fixedDays = (record.diasPagamentoFixos || record.dias_pagamento_fixos || [])
    .map((day) => Number(day))
    .filter((day) => day >= 1 && day <= 31)
    .sort((a, b) => a - b);

  if (fixedDays.length === 0) return [];

  const dates = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);

  while (cursor <= end) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();

    fixedDays.forEach((day) => {
      const candidate = new Date(year, month, day);

      if (
        candidate.getMonth() === month &&
        candidate >= start &&
        candidate <= end
      ) {
        dates.push(candidate);
      }
    });

    cursor.setMonth(cursor.getMonth() + 1);
  }

  dates.sort((a, b) => a - b);

  const amounts = distributeAmounts(toNumber(record.valorReceber), dates.length);

  return dates.map((date, index) => ({
    date: toISODate(date),
    amount: roundMoney(amounts[index] || 0),
    index,
    label: "Datas Fixas",
  }));
}

function buildCustomEntries(record) {
  return (record.parcelasPersonalizadas || record.parcelas_personalizadas || [])
    .filter((item) => item?.date && toNumber(item?.value) > 0)
    .map((item, index) => ({
      date: item.date,
      amount: roundMoney(toNumber(item.value)),
      index,
      label: item.descricao || "Parcela personalizada",
      descricao: item.descricao || "",
    }))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function buildRawEntries(record) {
  if (!record) return [];
  if (!record.abrirConta) return [];
  if (toNumber(record.valorReceber) <= 0) return [];

  const frequencia = normalizePaymentType(record.frequencia);

  if (frequencia === paymentTypes.DAILY) {
    return buildDailyEntries(record);
  }

  if (frequencia === paymentTypes.WEEKLY) {
    return buildWeeklyEntries(record);
  }

  if (frequencia === paymentTypes.FIXED_DATES) {
    return buildFixedDatesEntries(record);
  }

  if (frequencia === paymentTypes.CUSTOM) {
    return buildCustomEntries(record);
  }

  return [];
}

function getPaymentState(record, paymentKey) {
  if (!record?.pagamentos || typeof record.pagamentos !== "object") {
    return {};
  }

  return record.pagamentos[paymentKey] || {};
}

function getPaymentStatus(paymentState) {
  return paymentState.status || paymentStatuses.PENDING;
}

function isSettledStatus(status) {
  return status === paymentStatuses.PAID || status === paymentStatuses.CANCELED;
}

export function isPaymentSettled(event) {
  if (!event) return false;

  const status = event.statusPagamento || event.status;

  return isSettledStatus(status) || event.settled === true || event.isSettled === true;
}

export function buildCalendarEvents(records = []) {
  const events = [];

  (records || []).forEach((record) => {
    const rawEntries = buildRawEntries(record);

    rawEntries.forEach((entry) => {
      const paymentKey = `${record.id}__${entry.date}__${entry.index}`;
      const paymentState = getPaymentState(record, paymentKey);
      const statusPagamento = getPaymentStatus(paymentState);

      const originalAmount = roundMoney(entry.amount);

      const finePercent =
        statusPagamento === paymentStatuses.LATE
          ? toNumber(paymentState.multaPercentual ?? record.multaPercentual ?? 0)
          : toNumber(paymentState.multaPercentual ?? 0);

      const fineAmount = roundMoney((originalAmount * finePercent) / 100);
      const totalWithFine = roundMoney(originalAmount + fineAmount);
      const amountPaid = roundMoney(paymentState.valorPago || 0);

      let remainingAmount = totalWithFine;

      if (statusPagamento === paymentStatuses.PARTIAL) {
        remainingAmount = Math.max(0, roundMoney(totalWithFine - amountPaid));
      }

      if (isSettledStatus(statusPagamento)) {
        remainingAmount = 0;
      }

      const clientName = record.nome || "Cliente";

      events.push({
        id: paymentKey,
        paymentKey,
        eventKey: paymentKey,

        recordId: record.id,
        clientId: record.id,

        nome: clientName,
        clientName,
        nomeCliente: clientName,

        whatsapp: record.whatsapp || "",
        cpf: record.cpf || "",

        date: entry.date,
        data: entry.date,

        valor: remainingAmount,
        amount: remainingAmount,
        saldo: remainingAmount,
        remainingAmount,

        valorOriginal: originalAmount,
        originalAmount,

        valorComMulta: totalWithFine,
        totalWithFine,

        valorPago: amountPaid,
        amountPaid,

        multaPercentual: finePercent,
        finePercent,

        multaValor: fineAmount,
        fineAmount,

        statusPagamento,
        status: statusPagamento,

        settled: isSettledStatus(statusPagamento),
        isSettled: isSettledStatus(statusPagamento),

        tipo: entry.label,
        typeLabel: entry.label,
        descricao: entry.descricao || paymentState.observacao || "",
        observacao: paymentState.observacao || "",

        recordStatus: record.status || "Ativo",
        createdAt: record.createdAt || "",
      });
    });
  });

  return events.sort((a, b) => {
    if (a.date === b.date) {
      return String(a.clientName).localeCompare(String(b.clientName));
    }

    return String(a.date).localeCompare(String(b.date));
  });
}

export function getNextStatus(currentStatus) {
  if (currentStatus === "Ativo") return "Quitado";
  if (currentStatus === "Quitado") return "Ativo";
  if (currentStatus === "Recebido") return "Ativo";
  if (currentStatus === "Atrasado") return "Quitado";

  return "Ativo";
}

export function calculateTotals(records = []) {
  const safeRecords = Array.isArray(records) ? records : [];
  const calendarEvents = buildCalendarEvents(safeRecords);

  const clientes = safeRecords.length;

  const clientesAtivos = safeRecords.filter(
    (record) => record.status !== "Quitado"
  ).length;

  const contasAbertas = safeRecords.filter(
    (record) => record.abrirConta && record.status !== "Quitado"
  ).length;

  const enviadoAtual = safeRecords
    .filter((record) => record.status !== "Quitado")
    .reduce((sum, record) => sum + toNumber(record.valorEnviado), 0);

  const receberAtual = safeRecords
    .filter((record) => record.status !== "Quitado")
    .reduce((sum, record) => sum + toNumber(record.valorReceber), 0);

  const historicoEnviado = safeRecords.reduce((sum, record) => {
    const loans = Array.isArray(record.historicoEmprestimos)
      ? record.historicoEmprestimos
      : [];

    return (
      sum +
      loans.reduce((acc, loan) => acc + toNumber(loan.valorEnviado), 0)
    );
  }, 0);

  const historicoReceber = safeRecords.reduce((sum, record) => {
    const loans = Array.isArray(record.historicoEmprestimos)
      ? record.historicoEmprestimos
      : [];

    return (
      sum +
      loans.reduce((acc, loan) => acc + toNumber(loan.valorReceber), 0)
    );
  }, 0);

  const enviadoGeral = roundMoney(
    safeRecords.reduce((sum, record) => sum + toNumber(record.valorEnviado), 0) +
      historicoEnviado
  );

  const receberGeral = roundMoney(
    safeRecords.reduce((sum, record) => sum + toNumber(record.valorReceber), 0) +
      historicoReceber
  );

  const totalRecebido = calendarEvents.reduce((sum, event) => {
    if (event.statusPagamento === paymentStatuses.PAID) {
      return sum + toNumber(event.totalWithFine || event.valorOriginal);
    }

    if (event.statusPagamento === paymentStatuses.PARTIAL) {
      return sum + toNumber(event.valorPago);
    }

    return sum;
  }, 0);

  const totalAtrasado = calendarEvents
    .filter((event) => event.statusPagamento === paymentStatuses.LATE)
    .reduce((sum, event) => sum + toNumber(event.saldo || event.valor), 0);

  const totalPendente = calendarEvents
    .filter(
      (event) =>
        event.statusPagamento === paymentStatuses.PENDING ||
        event.statusPagamento === paymentStatuses.PARTIAL
    )
    .reduce((sum, event) => sum + toNumber(event.saldo || event.valor), 0);

  const today = toISODate(new Date());
  const tomorrow = toISODate(addDays(new Date(), 1));

  const receberHoje = calendarEvents.filter(
    (event) => event.date === today && !isPaymentSettled(event)
  );

  const receberAmanha = calendarEvents.filter(
    (event) => event.date === tomorrow && !isPaymentSettled(event)
  );

  const paidCount = calendarEvents.filter(
    (event) => event.statusPagamento === paymentStatuses.PAID
  ).length;

  const pendingCount = calendarEvents.filter(
    (event) =>
      event.statusPagamento === paymentStatuses.PENDING ||
      event.statusPagamento === paymentStatuses.PARTIAL
  ).length;

  const lateCount = calendarEvents.filter(
    (event) => event.statusPagamento === paymentStatuses.LATE
  ).length;

  return {
    clientes,
    clientesAtivos,
    contasAbertas,

    enviado: roundMoney(enviadoAtual),
    receber: roundMoney(receberAtual),
    lucro: roundMoney(receberAtual - enviadoAtual),

    enviadoGeral,
    receberGeral,
    lucroGeral: roundMoney(receberGeral - enviadoGeral),

    totalEmprestado: enviadoGeral,
    totalReceber: receberGeral,
    totalReceberAtual: roundMoney(receberAtual),
    totalEnviadoAtual: roundMoney(enviadoAtual),
    lucroAtual: roundMoney(receberAtual - enviadoAtual),

    totalRecebido: roundMoney(totalRecebido),
    totalAtrasado: roundMoney(totalAtrasado),
    totalPendente: roundMoney(totalPendente),

    receberHoje,
    receberAmanha,

    paidCount,
    pendingCount,
    lateCount,

    historicoQuitado: safeRecords.filter((record) => record.status === "Quitado")
      .length,
  };
}

export function getClientRisk(record) {
  const safeRecord = record || {};
  const events = buildCalendarEvents([safeRecord]);

  const lateCount = events.filter(
    (event) => event.statusPagamento === paymentStatuses.LATE
  ).length;

  const partialCount = events.filter(
    (event) => event.statusPagamento === paymentStatuses.PARTIAL
  ).length;

  const paidCount = events.filter(
    (event) => event.statusPagamento === paymentStatuses.PAID
  ).length;

  const historico = Array.isArray(safeRecord.historicoEmprestimos)
    ? safeRecord.historicoEmprestimos
    : [];

  const totalLoans = 1 + historico.length;

  if (safeRecord.status === "Bloqueado") {
    return {
      label: "Bloqueado",
      description: "Cliente bloqueado manualmente.",
      color: "border-rose-500/30 bg-rose-500/10 text-rose-300",
      className: "border-rose-500/30 bg-rose-500/10 text-rose-300",
    };
  }

  if (lateCount >= 3) {
    return {
      label: "Risco alto",
      description:
        "Cliente com muitos atrasos. Analise com cuidado antes de emprestar novamente.",
      color: "border-rose-500/30 bg-rose-500/10 text-rose-300",
      className: "border-rose-500/30 bg-rose-500/10 text-rose-300",
    };
  }

  if (lateCount >= 1 || partialCount >= 2) {
    return {
      label: "Atenção",
      description:
        "Cliente possui atraso ou pagamento parcial no histórico recente.",
      color: "border-amber-500/30 bg-amber-500/10 text-amber-300",
      className: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    };
  }

  if (paidCount > 0 || totalLoans > 1) {
    return {
      label: "Bom pagador",
      description: "Cliente com comportamento positivo de pagamento.",
      color: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    };
  }

  return {
    label: "Novo",
    description: "Ainda não há histórico suficiente para avaliar.",
    color: "border-orange-500/30 bg-orange-500/10 text-orange-300",
    className: "border-orange-500/30 bg-orange-500/10 text-orange-300",
  };
}

export function getClientMetrics(record) {
  const safeRecord = record || {};

  const historico = Array.isArray(safeRecord.historicoEmprestimos)
    ? safeRecord.historicoEmprestimos
    : [];

  const events = buildCalendarEvents([safeRecord]);

  const historicoEnviado = historico.reduce(
    (sum, loan) => sum + toNumber(loan?.valorEnviado),
    0
  );

  const historicoReceber = historico.reduce(
    (sum, loan) => sum + toNumber(loan?.valorReceber),
    0
  );

  const historicoLucro = historico.reduce((sum, loan) => {
    if (loan?.lucro !== undefined) {
      return sum + toNumber(loan.lucro);
    }

    return sum + toNumber(loan?.valorReceber) - toNumber(loan?.valorEnviado);
  }, 0);

  const valorEnviadoAtual = toNumber(safeRecord.valorEnviado);
  const valorReceberAtual = toNumber(safeRecord.valorReceber);
  const lucroAtual = valorReceberAtual - valorEnviadoAtual;

  const totalReceivedCurrent = events.reduce((sum, event) => {
    const status = event.statusPagamento;

    if (status === paymentStatuses.PAID) {
      return sum + toNumber(event.totalWithFine || event.valorOriginal);
    }

    if (status === paymentStatuses.PARTIAL) {
      return sum + toNumber(event.valorPago);
    }

    return sum;
  }, 0);

  const totalOpenCurrent = events.reduce((sum, event) => {
    if (isPaymentSettled(event)) return sum;

    return sum + toNumber(event.saldo || event.valor);
  }, 0);

  const totalLateCurrent = events
    .filter((event) => event.statusPagamento === paymentStatuses.LATE)
    .reduce((sum, event) => sum + toNumber(event.saldo || event.valor), 0);

  const lateCount = events.filter(
    (event) => event.statusPagamento === paymentStatuses.LATE
  ).length;

  const partialCount = events.filter(
    (event) => event.statusPagamento === paymentStatuses.PARTIAL
  ).length;

  const paidCount = events.filter(
    (event) => event.statusPagamento === paymentStatuses.PAID
  ).length;

  const pendingCount = events.filter(
    (event) =>
      !event.statusPagamento ||
      event.statusPagamento === paymentStatuses.PENDING
  ).length;

  return {
    totalLoans: 1 + historico.length,

    totalSent: roundMoney(historicoEnviado + valorEnviadoAtual),
    totalExpected: roundMoney(historicoReceber + valorReceberAtual),
    totalProfit: roundMoney(historicoLucro + lucroAtual),

    totalEnviado: roundMoney(historicoEnviado + valorEnviadoAtual),
    totalAReceber: roundMoney(historicoReceber + valorReceberAtual),
    totalLucro: roundMoney(historicoLucro + lucroAtual),

    valorEnviadoAtual: roundMoney(valorEnviadoAtual),
    valorReceberAtual: roundMoney(valorReceberAtual),
    lucroAtual: roundMoney(lucroAtual),

    totalReceivedCurrent: roundMoney(totalReceivedCurrent),
    totalOpenCurrent: roundMoney(totalOpenCurrent),
    totalLateCurrent: roundMoney(totalLateCurrent),

    recebidoAtual: roundMoney(totalReceivedCurrent),
    abertoAtual: roundMoney(totalOpenCurrent),
    atrasadoAtual: roundMoney(totalLateCurrent),

    currentLateCount: lateCount,
    lateCount,
    partialCount,
    paidCount,
    pendingCount,
  };
}

export function groupEventsByDay(events = [], days = 7) {
  const today = new Date();
  const result = [];

  for (let index = 0; index < days; index += 1) {
    const date = addDays(today, index);
    const key = toISODate(date);

    const bucket = events.filter((event) => event.date === key);

    result.push({
      key,
      date: key,
      label: date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      }),
      previsto: roundMoney(
        bucket.reduce(
          (sum, event) => sum + toNumber(event.valorOriginal || event.originalAmount || event.valor),
          0
        )
      ),
      recebido: roundMoney(
        bucket.reduce((sum, event) => {
          if (event.statusPagamento === paymentStatuses.PAID) {
            return sum + toNumber(event.valorComMulta || event.totalWithFine || event.valorOriginal || event.valor);
          }

          if (event.statusPagamento === paymentStatuses.PARTIAL) {
            return sum + toNumber(event.valorPago || event.amountPaid);
          }

          return sum;
        }, 0)
      ),
    });
  }

  return result;
}

export function groupEventsByMonth(events = []) {
  const map = new Map();

  events.forEach((event) => {
    const date = parseISODate(event.date);

    if (!date) return;

    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      "0"
    )}`;

    if (!map.has(key)) {
      map.set(key, {
        key,
        label: date.toLocaleDateString("pt-BR", {
          month: "short",
        }),
        previsto: 0,
        recebido: 0,
        atrasado: 0,
      });
    }

    const item = map.get(key);

    item.previsto += toNumber(
      event.valorOriginal || event.originalAmount || event.valor
    );

    if (event.statusPagamento === paymentStatuses.PAID) {
      item.recebido += toNumber(
        event.valorComMulta || event.totalWithFine || event.valorOriginal || event.valor
      );
    }

    if (event.statusPagamento === paymentStatuses.PARTIAL) {
      item.recebido += toNumber(event.valorPago || event.amountPaid);
    }

    if (event.statusPagamento === paymentStatuses.LATE) {
      item.atrasado += toNumber(event.saldo || event.remainingAmount || event.valor);
    }
  });

  return Array.from(map.values())
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((item) => ({
      ...item,
      previsto: roundMoney(item.previsto),
      recebido: roundMoney(item.recebido),
      atrasado: roundMoney(item.atrasado),
    }));
}
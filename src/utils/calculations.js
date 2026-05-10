import { todayISO } from "./helpers";

export const paymentTypes = {
  DAILY: "Diário",
  WEEKLY: "Semanal",
  FIXED_DATES: "Datas fixas",
  CUSTOM: "Personalizado",
};

export const paymentStatuses = {
  PENDING: "Pendente",
  PAID: "Pago",
  LATE: "Atrasado",
  PARTIAL: "Parcial",
  RENEGOTIATED: "Renegociado",
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
  dataInicio: todayISO(),
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
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateReceivable(valorEnviado, porcentagemRetorno) {
  const enviado = toNumber(valorEnviado);
  const percentual = toNumber(porcentagemRetorno);

  return enviado + enviado * (percentual / 100);
}

export function calculateLateAmount(baseAmount, multaPercentual) {
  const base = toNumber(baseAmount);
  const multa = toNumber(multaPercentual);

  return base + base * (multa / 100);
}

export function getDateOnly(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function normalizeDateString(dateString) {
  if (!dateString) return "";

  if (typeof dateString === "string" && dateString.includes("T")) {
    return dateString.slice(0, 10);
  }

  return String(dateString).slice(0, 10);
}

export function makePaymentId(recordId, dateString, index = 0) {
  return `${recordId}-${dateString}-${index}`;
}

export function getDailyPaymentDays(startDateString, endDateString) {
  const start = startDateString
    ? getDateOnly(new Date(`${startDateString}T00:00:00`))
    : getDateOnly(new Date());

  const end = endDateString
    ? getDateOnly(new Date(`${endDateString}T00:00:00`))
    : new Date(start.getFullYear(), start.getMonth() + 1, 0);

  const days = [];

  if (end < start) return days;

  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    if (date.getDay() !== 0) {
      days.push(new Date(date));
    }
  }

  return days;
}

export function getWeeklyPaymentDays(startDateString, weeks, dayOfWeek) {
  const start = startDateString
    ? getDateOnly(new Date(`${startDateString}T00:00:00`))
    : getDateOnly(new Date());

  const quantity = Math.max(1, toNumber(weeks));
  const wantedDay = toNumber(dayOfWeek);

  const days = [];
  const current = new Date(start);

  while (current.getDay() !== wantedDay) {
    current.setDate(current.getDate() + 1);
  }

  for (let i = 0; i < quantity; i++) {
    const paymentDate = new Date(current);
    paymentDate.setDate(current.getDate() + i * 7);
    days.push(paymentDate);
  }

  return days;
}

export function getFixedDatePaymentDays(startDateString, endDateString, fixedDays) {
  const start = startDateString
    ? getDateOnly(new Date(`${startDateString}T00:00:00`))
    : getDateOnly(new Date());

  const end = endDateString
    ? getDateOnly(new Date(`${endDateString}T00:00:00`))
    : new Date(start.getFullYear(), start.getMonth() + 1, 0);

  const cleanDays = (fixedDays || [])
    .map((day) => Math.floor(toNumber(day)))
    .filter((day) => day >= 1 && day <= 31)
    .sort((a, b) => a - b);

  if (end < start || cleanDays.length === 0) return [];

  const days = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);

  while (cursor <= end) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();

    cleanDays.forEach((dayNumber) => {
      const validDay = Math.min(dayNumber, lastDayOfMonth);
      const paymentDate = getDateOnly(new Date(year, month, validDay));

      if (paymentDate >= start && paymentDate <= end) {
        days.push(paymentDate);
      }
    });

    cursor.setMonth(cursor.getMonth() + 1);
  }

  return days.sort((a, b) => a - b);
}

export function getCustomInstallments(record) {
  return (record.parcelasPersonalizadas || [])
    .map((item, index) => {
      const date = normalizeDateString(item.date || item.data || item.dataPagamento);
      const value = toNumber(item.value || item.valor || item.valorParcela);

      return {
        id: item.id || `${record.id || "custom"}-${date}-${index}`,
        date,
        value,
        descricao: item.descricao || item.observacao || "",
      };
    })
    .filter((item) => item.date && item.value > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function getRecordPaymentDates(record) {
  if (!record.abrirConta || toNumber(record.valorReceber) <= 0) return [];

  if (record.frequencia === paymentTypes.DAILY) {
    return getDailyPaymentDays(record.dataInicio, record.dataTermino);
  }

  if (record.frequencia === paymentTypes.WEEKLY) {
    return getWeeklyPaymentDays(record.dataInicio, record.semanas, record.diaPagamento);
  }

  if (record.frequencia === paymentTypes.FIXED_DATES) {
    return getFixedDatePaymentDays(
      record.dataInicio,
      record.dataTermino,
      record.diasPagamentoFixos || []
    );
  }

  if (record.frequencia === paymentTypes.CUSTOM) {
    return getCustomInstallments(record).map((item) => new Date(`${item.date}T00:00:00`));
  }

  return [];
}

export function calculateInstallment(record) {
  if (!record.abrirConta && !record.valorReceber) return 0;

  const valorReceber = toNumber(record.valorReceber);

  if (record.frequencia === paymentTypes.CUSTOM) {
    return 0;
  }

  const days = getRecordPaymentDates(record);

  return days.length ? valorReceber / days.length : valorReceber;
}

export function getPaymentData(record, eventKey) {
  return record.pagamentos?.[eventKey] || {};
}

export function getPaymentStatus(record, eventKey, dateString) {
  const savedPayment = getPaymentData(record, eventKey);

  if (savedPayment?.status) {
    return savedPayment.status;
  }

  const today = getDateOnly(new Date());
  const date = getDateOnly(new Date(`${dateString}T00:00:00`));

  if (record.status === "Atrasado" || date < today) {
    return paymentStatuses.LATE;
  }

  return paymentStatuses.PENDING;
}

export function getPaymentFine(record, eventKey) {
  const savedPayment = getPaymentData(record, eventKey);

  if (savedPayment?.multaPercentual !== undefined) {
    return toNumber(savedPayment.multaPercentual);
  }

  return toNumber(record.multaPercentual);
}

export function getPaidAmount(record, eventKey) {
  const savedPayment = getPaymentData(record, eventKey);

  return toNumber(savedPayment.valorPago);
}

export function getPaymentNote(record, eventKey) {
  const savedPayment = getPaymentData(record, eventKey);

  return savedPayment.observacao || "";
}

export function buildEventFromPayment({
  record,
  dateString,
  baseAmount,
  index = 0,
  customId,
  descricao = "",
}) {
  const eventKey = customId || makePaymentId(record.id, dateString, index);
  const statusPagamento = getPaymentStatus(record, eventKey, dateString);
  const multaPercentual = getPaymentFine(record, eventKey);

  const valorOriginal = toNumber(baseAmount);
  const valorComMulta =
    statusPagamento === paymentStatuses.LATE
      ? calculateLateAmount(valorOriginal, multaPercentual)
      : valorOriginal;

  const valorPago = getPaidAmount(record, eventKey);

  const valorEmAberto =
    statusPagamento === paymentStatuses.PAID || statusPagamento === paymentStatuses.CANCELED
      ? 0
      : Math.max(0, valorComMulta - valorPago);

  return {
    recordId: record.id,
    date: dateString,
    nome: record.nome,

    eventKey,
    paymentKey: eventKey,

    valor: valorEmAberto,
    valorOriginal,
    valorComMulta,
    valorPago,
    saldo: valorEmAberto,

    tipo: record.frequencia,
    statusPagamento,

    atrasado: statusPagamento === paymentStatuses.LATE,
    pago: statusPagamento === paymentStatuses.PAID,
    parcial: statusPagamento === paymentStatuses.PARTIAL,
    renegociado: statusPagamento === paymentStatuses.RENEGOTIATED,
    cancelado: statusPagamento === paymentStatuses.CANCELED,

    multaPercentual,
    observacao: getPaymentNote(record, eventKey),
    descricao,

    id: eventKey,
  };
}

export function buildCalendarEvents(records) {
  const events = [];

  records
    .filter(
      (record) =>
        record.abrirConta !== false &&
        record.status !== "Quitado" &&
        toNumber(record.valorReceber) > 0
    )
    .forEach((record) => {
      if (record.frequencia === paymentTypes.CUSTOM) {
        getCustomInstallments(record).forEach((installment, index) => {
          events.push(
            buildEventFromPayment({
              record,
              dateString: installment.date,
              baseAmount: installment.value,
              index,
              customId: installment.id,
              descricao: installment.descricao,
            })
          );
        });

        return;
      }

      const days = getRecordPaymentDates(record);
      const baseAmount = calculateInstallment(record);

      days.forEach((date, index) => {
        const dateString = date.toISOString().slice(0, 10);

        events.push(
          buildEventFromPayment({
            record,
            dateString,
            baseAmount,
            index,
          })
        );
      });
    });

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

export function isPaymentSettled(event) {
  return (
    event.statusPagamento === paymentStatuses.PAID ||
    event.statusPagamento === paymentStatuses.CANCELED
  );
}

export function calculateTotals(records) {
  const currentLoans = records.filter(
    (item) => item.abrirConta !== false && toNumber(item.valorReceber) > 0
  );

  const previousLoans = records.flatMap((item) =>
    (item.historicoEmprestimos || []).map((loan) => ({
      valorEnviado: toNumber(loan.valorEnviado),
      valorReceber: toNumber(loan.valorReceber),
      lucro: toNumber(loan.lucro),
    }))
  );

  const currentOpenLoans = currentLoans.filter((item) => item.status !== "Quitado");
  const currentClosedLoans = currentLoans.filter((item) => item.status === "Quitado");

  const enviadoAtual = currentOpenLoans.reduce(
    (sum, item) => sum + toNumber(item.valorEnviado),
    0
  );

  const receberAtual = currentOpenLoans.reduce(
    (sum, item) => sum + toNumber(item.valorReceber),
    0
  );

  const enviadoHistorico =
    previousLoans.reduce((sum, item) => sum + toNumber(item.valorEnviado), 0) +
    currentClosedLoans.reduce((sum, item) => sum + toNumber(item.valorEnviado), 0);

  const recebidoHistorico =
    previousLoans.reduce((sum, item) => sum + toNumber(item.valorReceber), 0) +
    currentClosedLoans.reduce((sum, item) => sum + toNumber(item.valorReceber), 0);

  const lucroHistorico = recebidoHistorico - enviadoHistorico;

  return {
    clientes: records.length,
    contas: currentLoans.length,

    enviado: enviadoAtual,
    receber: receberAtual,
    lucro: receberAtual - enviadoAtual,

    enviadoHistorico,
    recebidoHistorico,
    lucroHistorico,

    enviadoGeral: enviadoAtual + enviadoHistorico,
    receberGeral: receberAtual + recebidoHistorico,
    lucroGeral: receberAtual - enviadoAtual + lucroHistorico,

    ativos: currentOpenLoans.filter((item) => item.status === "Ativo").length,
    atrasados: currentOpenLoans.filter((item) => item.status === "Atrasado").length,
    historico: previousLoans.length + currentClosedLoans.length,
  };
}

export function getNextStatus(currentStatus) {
  if (currentStatus === "Ativo") return "Recebido";
  if (currentStatus === "Recebido") return "Atrasado";
  if (currentStatus === "Atrasado") return "Ativo";

  return "Ativo";
}
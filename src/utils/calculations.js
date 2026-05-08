import { todayISO } from "./helpers";

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
  frequencia: "Diário",
  dataInicio: todayISO(),
  dataTermino: "",
  semanas: "4",
  diaPagamento: "5",
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

export function calculateInstallment(record) {
  if (!record.abrirConta && !record.valorReceber) return 0;

  const valorReceber = toNumber(record.valorReceber);

  if (record.frequencia === "Diário") {
    const days = getDailyPaymentDays(record.dataInicio, record.dataTermino);
    return days.length ? valorReceber / days.length : valorReceber;
  }

  const weeks = Math.max(1, toNumber(record.semanas));
  return valorReceber / weeks;
}

export function getRecordPaymentDates(record) {
  if (!record.abrirConta || toNumber(record.valorReceber) <= 0) return [];

  if (record.frequencia === "Diário") {
    return getDailyPaymentDays(record.dataInicio, record.dataTermino);
  }

  return getWeeklyPaymentDays(record.dataInicio, record.semanas, record.diaPagamento);
}

export function getPaymentStatus(record, dateString) {
  const savedPayment = record.pagamentos?.[dateString];

  if (savedPayment?.status) {
    return savedPayment.status;
  }

  const today = getDateOnly(new Date());
  const date = getDateOnly(new Date(`${dateString}T00:00:00`));

  if (record.status === "Atrasado" || date < today) {
    return "Atrasado";
  }

  return "Pendente";
}

export function getPaymentFine(record, dateString) {
  const savedPayment = record.pagamentos?.[dateString];

  if (savedPayment?.multaPercentual !== undefined) {
    return toNumber(savedPayment.multaPercentual);
  }

  return toNumber(record.multaPercentual);
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
      const days = getRecordPaymentDates(record);
      const baseAmount = calculateInstallment(record);

      days.forEach((date) => {
        const dateString = date.toISOString().slice(0, 10);
        const statusPagamento = getPaymentStatus(record, dateString);
        const multaPercentual = getPaymentFine(record, dateString);
        const isLate = statusPagamento === "Atrasado";
        const isPaid = statusPagamento === "Pago";

        events.push({
          recordId: record.id,
          date: dateString,
          nome: record.nome,
          valor: isLate ? calculateLateAmount(baseAmount, multaPercentual) : baseAmount,
          baseValor: baseAmount,
          tipo: record.frequencia,
          statusPagamento,
          atrasado: isLate,
          pago: isPaid,
          multaPercentual,
          id: `${record.id}-${dateString}`,
        });
      });
    });

  return events.sort((a, b) => a.date.localeCompare(b.date));
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
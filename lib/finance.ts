import { addDays, addMonths, addWeeks, differenceInCalendarDays, format, parseISO } from "date-fns";
import type { FixedScheduleRule, Installment, PaymentStatus } from "@/lib/types";

export const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function money(value: number | string | null | undefined) {
  return currency.format(Number(value || 0));
}

export function calculateLoan(
  principal: number,
  type: "percentage" | "fixed",
  returnValue: number,
) {
  const profit = type === "percentage" ? principal * (returnValue / 100) : returnValue;
  return {
    principal,
    expectedProfit: roundMoney(profit),
    totalReceivable: roundMoney(principal + profit),
    returnPercentage: type === "percentage" ? returnValue : principal > 0 ? (profit / principal) * 100 : 0,
  };
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function splitInstallments(total: number, count: number) {
  if (count <= 0) return [];
  const base = Math.floor((total / count) * 100) / 100;
  const values = Array.from({ length: count }, () => base);
  const diff = roundMoney(total - base * count);
  values[count - 1] = roundMoney(values[count - 1] + diff);
  return values;
}

function lastDayOfMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function nthBusinessDay(year: number, month: number, nth: number) {
  let found = 0;
  const last = lastDayOfMonth(year, month);
  for (let day = 1; day <= last; day++) {
    const date = new Date(year, month, day);
    const weekday = date.getDay();
    if (weekday !== 0 && weekday !== 6) {
      found += 1;
      if (found === nth) return date;
    }
  }
  return null;
}

function dateForFixedRule(year: number, month: number, rule: FixedScheduleRule) {
  if (rule.type === "BUSINESS_DAY") {
    return nthBusinessDay(year, month, Math.max(1, Math.min(23, Math.floor(rule.value))));
  }

  const day = Math.max(1, Math.min(31, Math.floor(rule.value)));
  return new Date(year, month, Math.min(day, lastDayOfMonth(year, month)));
}

export function generateFixedDueDates(
  anchorDate: string,
  count: number,
  rules: FixedScheduleRule[],
) {
  const anchor = parseISO(anchorDate);
  const validRules = rules.filter(rule =>
    (rule.type === "DAY_OF_MONTH" && rule.value >= 1 && rule.value <= 31) ||
    (rule.type === "BUSINESS_DAY" && rule.value >= 1 && rule.value <= 23)
  );
  if (!anchorDate || Number.isNaN(anchor.getTime())) throw new Error("Informe a data inicial das cobranças.");
  if (!validRules.length) throw new Error("Configure pelo menos uma regra de data fixa.");

  const result: string[] = [];
  let cursor = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  let safety = 0;

  while (result.length < count && safety < 240) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const candidates = validRules
      .map(rule => dateForFixedRule(year, month, rule))
      .filter((date): date is Date => Boolean(date))
      .filter(date => date >= anchor)
      .map(date => format(date, "yyyy-MM-dd"));

    for (const date of Array.from(new Set(candidates)).sort()) {
      if (result.length >= count) break;
      result.push(date);
    }

    cursor = addMonths(cursor, 1);
    safety += 1;
  }

  if (result.length < count) throw new Error("Não foi possível gerar todas as parcelas com as regras escolhidas.");
  return result;
}

export function generateDueDates(
  firstDueDate: string,
  frequency: string,
  count: number,
  dailyOffDays: number[] = [],
) {
  const first = parseISO(firstDueDate);

  if (frequency === "DIARIO") {
    const offDays = new Set(dailyOffDays.filter(day => Number.isInteger(day) && day >= 0 && day <= 6));
    if (offDays.size >= 7) throw new Error("O pagamento diário precisa ter pelo menos um dia de cobrança na semana.");

    const dates: string[] = [];
    let date = first;
    while (dates.length < count) {
      if (!offDays.has(date.getDay())) dates.push(format(date, "yyyy-MM-dd"));
      date = addDays(date, 1);
    }
    return dates;
  }

  return Array.from({ length: count }, (_, i) => {
    let date = first;
    if (frequency === "SEMANAL") date = addWeeks(first, i);
    else if (frequency === "QUINZENAL") date = addDays(first, i * 15);
    else if (frequency === "MENSAL") date = addMonths(first, i);
    else if (frequency === "UNICO") date = first;
    else date = addMonths(first, i);
    return format(date, "yyyy-MM-dd");
  });
}

export function effectiveInstallmentStatus(
  installment: Pick<Installment, "amount" | "amount_paid" | "remaining_amount" | "due_date" | "stored_status">,
  today = format(new Date(), "yyyy-MM-dd"),
): PaymentStatus {
  if (installment.stored_status === "CANCELADO") return "CANCELADO";
  if (Number(installment.remaining_amount) <= 0) return "PAGO";
  if (Number(installment.amount_paid) > 0) return "PARCIAL";
  if (installment.due_date < today) return "ATRASADO";
  if (installment.stored_status === "REAGENDADO") return "REAGENDADO";
  return "PENDENTE";
}

export function daysOverdue(dueDate: string, remaining: number) {
  if (remaining <= 0) return 0;
  const diff = differenceInCalendarDays(new Date(), parseISO(dueDate));
  return Math.max(0, diff);
}

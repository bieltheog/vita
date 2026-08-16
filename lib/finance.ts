import { addDays, addMonths, addWeeks, differenceInCalendarDays, format, parseISO } from "date-fns";
import type { Installment, PaymentStatus } from "@/lib/types";

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

export function generateDueDates(
  firstDueDate: string,
  frequency: string,
  count: number,
) {
  const first = parseISO(firstDueDate);
  return Array.from({ length: count }, (_, i) => {
    let date = first;
    if (frequency === "DIARIO") date = addDays(first, i);
    else if (frequency === "SEMANAL") date = addWeeks(first, i);
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

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateDueDates, roundMoney, splitInstallments } from "@/lib/finance";

export type LoanRescheduleResult = { ok: true; message: string } | { ok: false; error: string };

const text = (form: FormData, key: string) => String(form.get(key) || "").trim();
const num = (form: FormData, key: string) => Number(String(form.get(key) || "0").replace(",", "."));

function readableError(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = String((error as { message?: unknown }).message || "").trim();
    if (message) return message;
  }
  return "Não foi possível corrigir o calendário do empréstimo.";
}

export async function reschedulePaidLoanAction(formData: FormData): Promise<LoanRescheduleResult> {
  try {
    const supabase = await createClient();
    if (!supabase) throw new Error("Ação indisponível. Configure o Supabase.");
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Sessão inválida.");

    const loanId = text(formData, "loan_id");
    const frequency = text(formData, "payment_frequency") || "MENSAL";
    const status = text(formData, "status") || "ATIVO";
    let futureCount = Math.max(1, Math.floor(num(formData, "future_installment_count") || 1));
    let firstDueDate = text(formData, "first_due_date");
    const dailyOffDays = frequency === "DIARIO"
      ? Array.from(new Set(formData.getAll("daily_off_days").map(Number).filter(day => Number.isInteger(day) && day >= 0 && day <= 6))).sort((a,b)=>a-b)
      : [];

    if (!loanId) throw new Error("Empréstimo não encontrado.");
    if (!["UNICO","DIARIO","SEMANAL","QUINZENAL","MENSAL","DATAS_FIXAS"].includes(frequency)) throw new Error("Forma de pagamento inválida.");
    if (!["ATIVO","FINALIZADO","CANCELADO"].includes(status)) throw new Error("Status inválido.");
    if (frequency === "UNICO") futureCount = 1;
    if (frequency === "DIARIO" && dailyOffDays.length >= 7) throw new Error("Escolha pelo menos um dia da semana com cobrança.");

    const [{ data: loan, error: loanError }, { data: installments, error: installmentsError }] = await Promise.all([
      supabase.from("loans").select("id,client_id,loan_code,status").eq("id", loanId).eq("user_id", user.id).single(),
      supabase.from("installments").select("id,installment_number,remaining_amount,stored_status,amount_paid").eq("loan_id", loanId).eq("user_id", user.id).order("installment_number"),
    ]);
    if (loanError || !loan) throw loanError || new Error("Empréstimo não encontrado.");
    if (installmentsError) throw installmentsError;
    if (loan.status === "CANCELADO") throw new Error("Não é possível corrigir um empréstimo cancelado.");

    const currentRemaining = roundMoney((installments || [])
      .filter(row => row.stored_status !== "CANCELADO")
      .reduce((sum, row) => sum + Number(row.remaining_amount), 0));
    if (currentRemaining <= 0) throw new Error("Este empréstimo não possui saldo pendente para reorganizar.");

    let dueDates: string[] = [];
    let futureValues: number[] = [];

    if (frequency === "DATAS_FIXAS") {
      dueDates = Array.from({ length: futureCount }, (_, index) => text(formData, `fixed_due_date_${index}`));
      futureValues = Array.from({ length: futureCount }, (_, index) => num(formData, `fixed_amount_${index}`));
      dueDates.forEach((date, index) => {
        if (!date) throw new Error(`Informe a data da parcela futura ${index + 1}.`);
        if (futureValues[index] <= 0) throw new Error(`Informe um valor válido para a parcela futura ${index + 1}.`);
        if (index > 0 && date <= dueDates[index - 1]) throw new Error("As datas futuras devem estar em ordem crescente e não podem se repetir.");
      });
      const configured = roundMoney(futureValues.reduce((sum, value) => sum + value, 0));
      if (Math.round(configured * 100) !== Math.round(currentRemaining * 100)) {
        throw new Error(`A soma das parcelas futuras precisa ser igual ao saldo atual: R$ ${currentRemaining.toFixed(2).replace(".", ",")}.`);
      }
      firstDueDate = dueDates[0] || "";
    } else {
      if (!firstDueDate) throw new Error("Informe o primeiro vencimento do novo calendário.");
      dueDates = generateDueDates(firstDueDate, frequency, futureCount, dailyOffDays);
      futureValues = splitInstallments(currentRemaining, futureCount);
    }

    const { error: rpcError } = await supabase.rpc("reschedule_paid_loan", {
      p_loan_id: loanId,
      p_payment_frequency: frequency,
      p_future_installment_count: futureCount,
      p_first_due_date: firstDueDate,
      p_daily_off_days: dailyOffDays,
      p_due_dates: dueDates,
      p_future_values: futureValues,
      p_status: status,
    });
    if (rpcError) throw rpcError;

    [
      "/dashboard", "/emprestimos", `/emprestimos/${loanId}`, "/pagamentos", "/calendario", "/cobrancas-hoje",
      "/fluxo-caixa", "/meu-caixa", "/relatorios", `/clientes/${loan.client_id}`,
    ].forEach(path => revalidatePath(path));

    return {
      ok: true,
      message: `Calendário do ${loan.loan_code} corrigido para ${frequency}. Pagamentos já registrados foram preservados e somente o saldo futuro foi reorganizado.`,
    };
  } catch (error) {
    console.error("reschedulePaidLoanAction", error);
    return { ok: false, error: readableError(error) };
  }
}

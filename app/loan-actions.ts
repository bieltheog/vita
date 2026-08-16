"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { calculateLoan, generateDueDates, splitInstallments } from "@/lib/finance";

async function authContext() {
  const supabase = await createClient();
  if (!supabase) throw new Error("Ação indisponível. Configure o Supabase.");
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Sessão inválida.");
  return { supabase, user };
}

const text = (form: FormData, key: string) => String(form.get(key) || "").trim();
const num = (form: FormData, key: string) => Number(String(form.get(key) || "0").replace(",", "."));

export async function updateLoanAction(formData: FormData) {
  const { supabase, user } = await authContext();
  const loanId = text(formData, "loan_id");
  const principal = num(formData, "principal_amount");
  const calculationType = (text(formData, "calculation_type") || "percentage") as "percentage" | "fixed";
  const returnValue = num(formData, "return_value");
  let installmentCount = Math.max(1, Math.floor(num(formData, "installment_count") || 1));
  const frequency = text(formData, "payment_frequency") || "MENSAL";
  const startDate = text(formData, "start_date");
  const customDate1 = text(formData, "custom_due_date_1");
  const customDate2 = text(formData, "custom_due_date_2");
  let firstDueDate = text(formData, "first_due_date");
  const status = text(formData, "status") || "ATIVO";

  if (!['UNICO','DIARIO','SEMANAL','QUINZENAL','MENSAL','PERSONALIZADO'].includes(frequency)) throw new Error("Forma de pagamento inválida.");
  if (frequency === "PERSONALIZADO") {
    installmentCount = 2;
    firstDueDate = customDate1;
    if (!customDate1 || !customDate2) throw new Error("Escolha a data das duas parcelas.");
    if (customDate2 < customDate1) throw new Error("A segunda parcela não pode vencer antes da primeira.");
  }
  if (!loanId || principal <= 0 || !startDate || !firstDueDate) throw new Error("Preencha os campos obrigatórios do empréstimo.");
  if (!['ATIVO','FINALIZADO','CANCELADO'].includes(status)) throw new Error("Status inválido.");

  const { data: current, error: findError } = await supabase
    .from("loans")
    .select("id,client_id,loan_code,principal_amount,return_percentage,fixed_return_amount,expected_profit,total_receivable,payment_frequency,installment_count,start_date,first_due_date,status")
    .eq("id", loanId)
    .eq("user_id", user.id)
    .single();
  if (findError || !current) throw findError || new Error("Empréstimo não encontrado.");

  const { data: existing, error: installmentsError } = await supabase
    .from("installments")
    .select("id,installment_number,due_date")
    .eq("loan_id", loanId)
    .eq("user_id", user.id)
    .order("installment_number");
  if (installmentsError) throw installmentsError;

  const currentType: "percentage" | "fixed" = current.fixed_return_amount != null ? "fixed" : "percentage";
  const currentReturn = currentType === "fixed" ? Number(current.fixed_return_amount || 0) : Number(current.return_percentage || 0);
  const requestedDates = frequency === "PERSONALIZADO" ? [customDate1, customDate2] : generateDueDates(firstDueDate, frequency, installmentCount);
  const currentDates = (existing || []).map(row => row.due_date);
  const datesChanged = requestedDates.length !== currentDates.length || requestedDates.some((date, index) => date !== currentDates[index]);
  const structuralChanged =
    Math.abs(Number(current.principal_amount) - principal) > 0.0001 ||
    currentType !== calculationType ||
    Math.abs(currentReturn - returnValue) > 0.0001 ||
    Number(current.installment_count) !== installmentCount ||
    current.payment_frequency !== frequency ||
    current.start_date !== startDate ||
    current.first_due_date !== firstDueDate ||
    datesChanged;

  const { data: paymentRows, error: paymentError } = await supabase
    .from("payments")
    .select("id")
    .eq("loan_id", loanId)
    .eq("user_id", user.id)
    .is("voided_at", null)
    .limit(1);
  if (paymentError) throw paymentError;
  const hasPayments = (paymentRows?.length || 0) > 0;

  if (hasPayments && structuralChanged) {
    throw new Error("Este empréstimo já possui pagamento registrado. Para preservar valores pagos e o histórico, altere apenas o status.");
  }

  const now = new Date().toISOString();
  if (hasPayments) {
    const { error } = await supabase.from("loans").update({ status, updated_at: now }).eq("id", loanId).eq("user_id", user.id);
    if (error) throw error;
  } else {
    const calc = calculateLoan(principal, calculationType, returnValue);
    const updates = {
      principal_amount: calc.principal,
      return_percentage: calc.returnPercentage,
      fixed_return_amount: calculationType === "fixed" ? returnValue : null,
      expected_profit: calc.expectedProfit,
      total_receivable: calc.totalReceivable,
      payment_frequency: frequency,
      installment_count: installmentCount,
      start_date: startDate,
      first_due_date: firstDueDate,
      status,
      updated_at: now,
    };

    const { error: updateError } = await supabase.from("loans").update(updates).eq("id", loanId).eq("user_id", user.id);
    if (updateError) throw updateError;

    const values = splitInstallments(calc.totalReceivable, installmentCount);
    const byNumber = new Map((existing || []).map(row => [Number(row.installment_number), row.id]));

    for (let index = 0; index < installmentCount; index++) {
      const installmentNumber = index + 1;
      const payload = {
        client_id: current.client_id,
        due_date: requestedDates[index],
        original_due_date: requestedDates[index],
        amount: values[index],
        amount_paid: 0,
        remaining_amount: values[index],
        stored_status: status === "CANCELADO" ? "CANCELADO" : "PENDENTE",
        paid_at: null,
        updated_at: now,
      };
      const existingId = byNumber.get(installmentNumber);
      if (existingId) {
        const { error } = await supabase.from("installments").update(payload).eq("id", existingId).eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("installments").insert({
          user_id: user.id,
          loan_id: loanId,
          client_id: current.client_id,
          installment_number: installmentNumber,
          due_date: requestedDates[index],
          original_due_date: requestedDates[index],
          amount: values[index],
          amount_paid: 0,
          remaining_amount: values[index],
          stored_status: status === "CANCELADO" ? "CANCELADO" : "PENDENTE",
        });
        if (error) throw error;
      }
    }

    const { error: deleteError } = await supabase
      .from("installments")
      .delete()
      .eq("loan_id", loanId)
      .eq("user_id", user.id)
      .gt("installment_number", installmentCount);
    if (deleteError) throw deleteError;
  }

  await supabase.from("activity_logs").insert({
    user_id: user.id,
    entity_type: "loan",
    entity_id: loanId,
    action: "updated",
    old_data: current,
    new_data: { principal, calculationType, returnValue, installmentCount, frequency, startDate, firstDueDate, customDate1, customDate2, status },
    description: `Empréstimo ${current.loan_code} atualizado e calendário sincronizado.`,
  });

  ["/dashboard", "/emprestimos", "/pagamentos", "/calendario", "/fluxo-caixa", "/relatorios", `/clientes/${current.client_id}`]
    .forEach(path => revalidatePath(path));
}

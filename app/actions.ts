"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { calculateLoan, generateDueDates, splitInstallments } from "@/lib/finance";

async function authContext() {
  const supabase = await createClient();
  if (!supabase) throw new Error("Ação indisponível no modo demonstração. Configure o Supabase para gravar dados.");
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Sessão inválida.");
  return { supabase, user };
}

const text = (form: FormData, key: string) => String(form.get(key) || "").trim();
const num = (form: FormData, key: string) => Number(String(form.get(key) || "0").replace(",", "."));
const nullable = (value: string) => value || null;

export async function createClientAction(formData: FormData) {
  const { supabase, user } = await authContext();
  const name = text(formData, "name");
  if (!name) throw new Error("Informe o nome do cliente.");
  const { error } = await supabase.from("clients").insert({
    user_id: user.id,
    name,
    cpf: nullable(text(formData, "cpf")), phone: nullable(text(formData, "phone")), whatsapp: nullable(text(formData, "whatsapp")),
    email: nullable(text(formData, "email")), birth_date: nullable(text(formData, "birth_date")), address: nullable(text(formData, "address")),
    city: nullable(text(formData, "city")), state: nullable(text(formData, "state")), zipcode: nullable(text(formData, "zipcode")),
    profession: nullable(text(formData, "profession")), notes: nullable(text(formData, "notes")),
  });
  if (error) throw error;
  revalidatePath("/clientes");
  revalidatePath("/dashboard");
}

export async function createLoanAction(formData: FormData) {
  const { supabase, user } = await authContext();
  const clientId = text(formData, "client_id");
  const principal = num(formData, "principal_amount");
  const calculationType = (text(formData, "calculation_type") || "percentage") as "percentage" | "fixed";
  const returnValue = num(formData, "return_value");
  const installmentCount = Math.max(1, Math.floor(num(formData, "installment_count") || 1));
  const frequency = text(formData, "payment_frequency") || "MENSAL";
  const startDate = text(formData, "start_date");
  const firstDueDate = text(formData, "first_due_date");
  if (!clientId || principal <= 0 || !startDate || !firstDueDate) throw new Error("Preencha os campos obrigatórios do empréstimo.");

  const calc = calculateLoan(principal, calculationType, returnValue);
  const { data: loan, error } = await supabase.from("loans").insert({
    user_id: user.id, client_id: clientId, principal_amount: calc.principal,
    return_percentage: calc.returnPercentage, fixed_return_amount: calculationType === "fixed" ? returnValue : null,
    expected_profit: calc.expectedProfit, total_receivable: calc.totalReceivable, payment_frequency: frequency,
    installment_count: installmentCount, start_date: startDate, first_due_date: firstDueDate, status: "ATIVO",
  }).select("id,loan_code").single();
  if (error) throw error;

  const dates = generateDueDates(firstDueDate, frequency, installmentCount);
  const values = splitInstallments(calc.totalReceivable, installmentCount);
  const { error: installmentsError } = await supabase.from("installments").insert(dates.map((dueDate, index) => ({
    user_id: user.id, loan_id: loan.id, client_id: clientId, installment_number: index + 1,
    due_date: dueDate, original_due_date: dueDate, amount: values[index], amount_paid: 0,
    remaining_amount: values[index], stored_status: "PENDENTE",
  })));
  if (installmentsError) throw installmentsError;

  await supabase.from("activity_logs").insert({ user_id: user.id, entity_type: "loan", entity_id: loan.id, action: "created", description: `Empréstimo ${loan.loan_code} criado.` });
  ["/dashboard", "/emprestimos", "/pagamentos", "/calendario", `/clientes/${clientId}`].forEach(revalidatePath);
}

export async function registerPaymentAction(formData: FormData) {
  const { supabase, user } = await authContext();
  const installmentId = text(formData, "installment_id");
  const amount = num(formData, "amount");
  const paymentDate = text(formData, "payment_date");
  const method = text(formData, "payment_method") || "PIX";
  if (!installmentId || amount <= 0 || !paymentDate) throw new Error("Informe parcela, valor e data.");

  const { data: installment, error: findError } = await supabase.from("installments").select("id,client_id,loan_id,remaining_amount").eq("id", installmentId).single();
  if (findError) throw findError;
  if (amount > Number(installment.remaining_amount)) throw new Error("O valor recebido não pode ultrapassar o saldo da parcela.");

  const { data: payment, error } = await supabase.from("payments").insert({
    user_id: user.id, client_id: installment.client_id, loan_id: installment.loan_id, installment_id: installmentId,
    amount, payment_date: paymentDate, payment_method: method, notes: nullable(text(formData, "notes")),
  }).select("id").single();
  if (error) throw error;
  await supabase.from("activity_logs").insert({ user_id: user.id, entity_type: "payment", entity_id: payment.id, action: "created", description: `Pagamento de R$ ${amount.toFixed(2)} registrado.` });
  ["/dashboard", "/pagamentos", "/calendario", "/fluxo-caixa", "/relatorios", `/clientes/${installment.client_id}`].forEach(revalidatePath);
}

export async function rescheduleInstallmentAction(formData: FormData) {
  const { supabase, user } = await authContext();
  const id = text(formData, "installment_id");
  const newDate = text(formData, "new_due_date");
  const reason = text(formData, "reason");
  const { data: old, error: findError } = await supabase.from("installments").select("due_date,client_id").eq("id", id).single();
  if (findError) throw findError;
  const { error } = await supabase.from("installments").update({ due_date: newDate, stored_status: "REAGENDADO" }).eq("id", id);
  if (error) throw error;
  await supabase.from("activity_logs").insert({ user_id: user.id, entity_type: "installment", entity_id: id, action: "rescheduled", old_data: { due_date: old.due_date }, new_data: { due_date: newDate, reason }, description: `Pagamento reagendado de ${old.due_date} para ${newDate}. ${reason}` });
  ["/calendario", "/pagamentos", "/dashboard", `/clientes/${old.client_id}`].forEach(revalidatePath);
}

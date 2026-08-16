"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { calculateLoan, generateDueDates, generateFixedDueDates, splitInstallments } from "@/lib/finance";
import type { FixedScheduleRule } from "@/lib/types";

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
const getDailyOffDays = (form: FormData, frequency: string) => frequency === "DIARIO"
  ? Array.from(new Set(form.getAll("daily_off_days").map(Number).filter(day => Number.isInteger(day) && day >= 0 && day <= 6))).sort((a,b)=>a-b)
  : [];

function getFixedRules(form: FormData, frequency: string): FixedScheduleRule[] {
  if (frequency !== "DATAS_FIXAS") return [];
  const rules: FixedScheduleRule[] = [];
  for (const index of [1,2]) {
    const type = text(form, `fixed_rule_${index}_type`);
    if (!type || type === "NONE") continue;
    const value = Math.floor(num(form, `fixed_rule_${index}_value`));
    if (type !== "DAY_OF_MONTH" && type !== "BUSINESS_DAY") throw new Error("Regra de data fixa inválida.");
    if (type === "DAY_OF_MONTH" && (value < 1 || value > 31)) throw new Error("O dia do mês precisa estar entre 1 e 31.");
    if (type === "BUSINESS_DAY" && (value < 1 || value > 23)) throw new Error("O dia útil precisa estar entre o 1º e o 23º dia útil do mês.");
    rules.push({ type, value });
  }
  if (!rules.length) throw new Error("Configure pelo menos uma regra para as datas fixas.");
  return rules;
}

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

export async function updateClientAction(formData: FormData) {
  const { supabase, user } = await authContext();
  const clientId = text(formData, "client_id");
  const name = text(formData, "name");
  if (!clientId) throw new Error("Cliente não identificado.");
  if (!name) throw new Error("Informe o nome do cliente.");

  const { data: current, error: findError } = await supabase
    .from("clients")
    .select("id,name,cpf,phone,whatsapp,email,birth_date,address,city,state,zipcode,profession,notes")
    .eq("id", clientId)
    .eq("user_id", user.id)
    .single();
  if (findError || !current) throw findError || new Error("Cliente não encontrado.");

  const updates = {
    name,
    cpf: nullable(text(formData, "cpf")),
    phone: nullable(text(formData, "phone")),
    whatsapp: nullable(text(formData, "whatsapp")),
    email: nullable(text(formData, "email")),
    birth_date: nullable(text(formData, "birth_date")),
    address: nullable(text(formData, "address")),
    city: nullable(text(formData, "city")),
    state: nullable(text(formData, "state").toUpperCase()),
    zipcode: nullable(text(formData, "zipcode")),
    profession: nullable(text(formData, "profession")),
    notes: nullable(text(formData, "notes")),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("clients").update(updates).eq("id", clientId).eq("user_id", user.id);
  if (error) throw error;

  await supabase.from("activity_logs").insert({
    user_id: user.id, entity_type: "client", entity_id: clientId, action: "updated",
    old_data: current, new_data: updates, description: `Cadastro de ${name} atualizado.`,
  });

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/dashboard");
}

export async function createLoanAction(formData: FormData) {
  const { supabase, user } = await authContext();
  const clientId = text(formData, "client_id");
  const principal = num(formData, "principal_amount");
  const calculationType = (text(formData, "calculation_type") || "percentage") as "percentage" | "fixed";
  const returnValue = num(formData, "return_value");
  let installmentCount = Math.max(1, Math.floor(num(formData, "installment_count") || 1));
  const frequency = text(formData, "payment_frequency") || "MENSAL";
  const dailyOffDays = getDailyOffDays(formData, frequency);
  const fixedRules = getFixedRules(formData, frequency);
  const startDate = text(formData, "start_date");
  const customDate1 = text(formData, "custom_due_date_1");
  const customDate2 = text(formData, "custom_due_date_2");
  let firstDueDate = text(formData, "first_due_date");

  if (!['UNICO','DIARIO','SEMANAL','QUINZENAL','MENSAL','DATAS_FIXAS','PERSONALIZADO'].includes(frequency)) throw new Error("Forma de pagamento inválida.");
  if (frequency === "DIARIO" && dailyOffDays.length >= 7) throw new Error("Escolha pelo menos um dia da semana com cobrança.");
  if (frequency === "PERSONALIZADO") {
    installmentCount = 2;
    firstDueDate = customDate1;
    if (!customDate1 || !customDate2) throw new Error("Escolha a data das duas parcelas.");
    if (customDate2 < customDate1) throw new Error("A segunda parcela não pode vencer antes da primeira.");
  }
  if (!clientId || principal <= 0 || !startDate || !firstDueDate) throw new Error("Preencha os campos obrigatórios do empréstimo.");

  const calc = calculateLoan(principal, calculationType, returnValue);
  const fixedSchedule = frequency === "DATAS_FIXAS" ? { rules: fixedRules } : {};
  const { data: loan, error } = await supabase.from("loans").insert({
    user_id: user.id, client_id: clientId, principal_amount: calc.principal,
    return_percentage: calc.returnPercentage, fixed_return_amount: calculationType === "fixed" ? returnValue : null,
    expected_profit: calc.expectedProfit, total_receivable: calc.totalReceivable, payment_frequency: frequency,
    installment_count: installmentCount, start_date: startDate, first_due_date: firstDueDate, daily_off_days: dailyOffDays,
    fixed_schedule: fixedSchedule, status: "ATIVO",
  }).select("id,loan_code").single();
  if (error) throw error;

  const dates = frequency === "PERSONALIZADO"
    ? [customDate1, customDate2]
    : frequency === "DATAS_FIXAS"
      ? generateFixedDueDates(firstDueDate, installmentCount, fixedRules)
      : generateDueDates(firstDueDate, frequency, installmentCount, dailyOffDays);
  const values = splitInstallments(calc.totalReceivable, installmentCount);
  const { error: installmentsError } = await supabase.from("installments").insert(dates.map((dueDate, index) => ({
    user_id: user.id, loan_id: loan.id, client_id: clientId, installment_number: index + 1,
    due_date: dueDate, original_due_date: dueDate, amount: values[index], amount_paid: 0,
    remaining_amount: values[index], stored_status: "PENDENTE",
  })));
  if (installmentsError) throw installmentsError;

  await supabase.from("activity_logs").insert({
    user_id: user.id, entity_type: "loan", entity_id: loan.id, action: "created",
    new_data: { frequency, dates, installmentCount, dailyOffDays, fixedSchedule }, description: `Empréstimo ${loan.loan_code} criado.`,
  });
  ["/dashboard", "/emprestimos", "/pagamentos", "/calendario", `/clientes/${clientId}`].forEach((path) => revalidatePath(path));
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
  ["/dashboard", "/pagamentos", "/calendario", "/fluxo-caixa", "/relatorios", `/clientes/${installment.client_id}`].forEach((path) => revalidatePath(path));
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
  ["/calendario", "/pagamentos", "/dashboard", `/clientes/${old.client_id}`].forEach((path) => revalidatePath(path));
}

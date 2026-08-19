"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CashActionResult = { ok: true; message?: string } | { ok: false; error: string };

function fail(error: unknown, fallback: string): CashActionResult {
  if (error instanceof Error && error.message) return { ok: false, error: error.message };
  if (typeof error === "object" && error && "message" in error) return { ok: false, error: String((error as {message?: unknown}).message || fallback) };
  return { ok: false, error: fallback };
}

function numberField(formData: FormData, name: string) {
  return Number(String(formData.get(name) || "0").replace(",", "."));
}

async function context() {
  const supabase = await createClient();
  if (!supabase) throw new Error("Ação indisponível no modo demonstração.");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão inválida.");
  return { supabase, user };
}

function revalidateCash() {
  ["/meu-caixa", "/dashboard", "/fluxo-caixa", "/relatorios"].forEach((path) => revalidatePath(path));
}

export async function saveCashAccountAction(formData: FormData): Promise<CashActionResult> {
  try {
    const { supabase, user } = await context();
    const openingBalance = numberField(formData, "opening_balance");
    const reserveAmount = numberField(formData, "reserve_amount");
    const trackingStartDate = String(formData.get("tracking_start_date") || "").trim();
    if (!Number.isFinite(openingBalance) || openingBalance < 0) return { ok: false, error: "Informe um capital inicial válido." };
    if (!Number.isFinite(reserveAmount) || reserveAmount < 0) return { ok: false, error: "Informe uma reserva válida." };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trackingStartDate)) return { ok: false, error: "Informe a data de início do caixa." };

    const payload = {
      user_id: user.id,
      opening_balance: openingBalance,
      reserve_amount: reserveAmount,
      tracking_start_date: trackingStartDate,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("cash_accounts").upsert(payload, { onConflict: "user_id" });
    if (error) return { ok: false, error: error.message };

    await supabase.from("activity_logs").insert({
      user_id: user.id,
      entity_type: "cash_account",
      entity_id: null,
      action: "updated",
      new_data: payload,
      description: "Configuração do Meu Caixa atualizada.",
    });
    revalidateCash();
    return { ok: true, message: "Configuração do caixa salva." };
  } catch (error) {
    return fail(error, "Não foi possível salvar o caixa.");
  }
}

export async function createCashEntryAction(formData: FormData): Promise<CashActionResult> {
  try {
    const { supabase, user } = await context();
    const entryType = String(formData.get("entry_type") || "").trim().toUpperCase();
    const category = String(formData.get("category") || "OUTRO").trim().toUpperCase();
    const amount = numberField(formData, "amount");
    const entryDate = String(formData.get("entry_date") || "").trim();
    const description = String(formData.get("description") || "").trim();
    if (!["ENTRADA","GASTO"].includes(entryType)) return { ok: false, error: "Escolha se é uma entrada ou gasto." };
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Informe um valor maior que zero." };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) return { ok: false, error: "Informe a data da movimentação." };

    const { data, error } = await supabase.from("cash_entries").insert({
      user_id: user.id,
      entry_type: entryType,
      category: category || "OUTRO",
      amount,
      entry_date: entryDate,
      description: description || null,
    }).select("id").single();
    if (error) return { ok: false, error: error.message };

    await supabase.from("activity_logs").insert({
      user_id: user.id,
      entity_type: "cash_entry",
      entity_id: data.id,
      action: "created",
      new_data: { entry_type: entryType, category, amount, entry_date: entryDate, description },
      description: `${entryType === "ENTRADA" ? "Entrada" : "Gasto"} de caixa registrado.`,
    });
    revalidateCash();
    return { ok: true, message: entryType === "ENTRADA" ? "Entrada adicionada ao caixa." : "Gasto registrado no caixa." };
  } catch (error) {
    return fail(error, "Não foi possível registrar a movimentação.");
  }
}

export async function voidCashEntryAction(formData: FormData): Promise<CashActionResult> {
  try {
    const { supabase, user } = await context();
    const id = String(formData.get("entry_id") || "").trim();
    if (!id) return { ok: false, error: "Movimentação não identificada." };

    const { data: current, error: findError } = await supabase
      .from("cash_entries")
      .select("id,entry_type,category,amount,entry_date,description,voided_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (findError || !current) return { ok: false, error: findError?.message || "Movimentação não encontrada." };
    if (current.voided_at) return { ok: false, error: "Essa movimentação já foi estornada." };

    const voidedAt = new Date().toISOString();
    const { error } = await supabase.from("cash_entries").update({ voided_at: voidedAt }).eq("id", id).eq("user_id", user.id);
    if (error) return { ok: false, error: error.message };

    await supabase.from("activity_logs").insert({
      user_id: user.id,
      entity_type: "cash_entry",
      entity_id: id,
      action: "voided",
      old_data: current,
      new_data: { voided_at: voidedAt },
      description: "Movimentação do Meu Caixa estornada sem apagar o histórico.",
    });
    revalidateCash();
    return { ok: true, message: "Movimentação estornada. O histórico foi preservado." };
  } catch (error) {
    return fail(error, "Não foi possível estornar a movimentação.");
  }
}

export async function createCashDebtAction(formData: FormData): Promise<CashActionResult> {
  try {
    const { supabase, user } = await context();
    const title = String(formData.get("title") || "").trim();
    const amount = numberField(formData, "amount");
    const dueDate = String(formData.get("due_date") || "").trim();
    const notes = String(formData.get("notes") || "").trim();
    if (!title) return { ok: false, error: "Informe a descrição da dívida." };
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Informe um valor maior que zero." };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return { ok: false, error: "Informe a data de vencimento." };

    const { data, error } = await supabase.from("cash_debts").insert({
      user_id: user.id,
      title,
      amount,
      due_date: dueDate,
      notes: notes || null,
      status: "PENDENTE",
    }).select("id").single();
    if (error) return { ok: false, error: error.message };

    await supabase.from("activity_logs").insert({
      user_id: user.id,
      entity_type: "cash_debt",
      entity_id: data.id,
      action: "created",
      new_data: { title, amount, due_date: dueDate, notes },
      description: `Dívida "${title}" registrada para ${dueDate}.`,
    });
    revalidateCash();
    return { ok: true, message: "Dívida adicionada ao calendário financeiro." };
  } catch (error) {
    return fail(error, "Não foi possível registrar a dívida.");
  }
}

export async function payCashDebtAction(formData: FormData): Promise<CashActionResult> {
  try {
    const { supabase, user } = await context();
    const debtId = String(formData.get("debt_id") || "").trim();
    const paymentDate = String(formData.get("payment_date") || "").trim();
    if (!debtId) return { ok: false, error: "Dívida não identificada." };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) return { ok: false, error: "Informe a data do pagamento." };

    const { data: debt, error: debtError } = await supabase.from("cash_debts").select("id,title,amount,due_date,status").eq("id", debtId).eq("user_id", user.id).maybeSingle();
    if (debtError || !debt) return { ok: false, error: debtError?.message || "Dívida não encontrada." };

    const { error } = await supabase.rpc("pay_cash_debt", { p_debt_id: debtId, p_payment_date: paymentDate });
    if (error) return { ok: false, error: error.message };

    await supabase.from("activity_logs").insert({
      user_id: user.id,
      entity_type: "cash_debt",
      entity_id: debtId,
      action: "paid",
      old_data: debt,
      new_data: { status: "PAGO", payment_date: paymentDate },
      description: `Dívida "${debt.title}" marcada como paga e descontada do Meu Caixa.`,
    });
    revalidateCash();
    return { ok: true, message: "Dívida paga. O valor foi descontado do caixa." };
  } catch (error) {
    return fail(error, "Não foi possível pagar a dívida.");
  }
}

export async function unpayCashDebtAction(formData: FormData): Promise<CashActionResult> {
  try {
    const { supabase, user } = await context();
    const debtId = String(formData.get("debt_id") || "").trim();
    if (!debtId) return { ok: false, error: "Dívida não identificada." };

    const { data: debt, error: debtError } = await supabase.from("cash_debts").select("id,title,amount,due_date,status,payment_date,cash_entry_id").eq("id", debtId).eq("user_id", user.id).maybeSingle();
    if (debtError || !debt) return { ok: false, error: debtError?.message || "Dívida não encontrada." };

    const { error } = await supabase.rpc("unpay_cash_debt", { p_debt_id: debtId });
    if (error) return { ok: false, error: error.message };

    await supabase.from("activity_logs").insert({
      user_id: user.id,
      entity_type: "cash_debt",
      entity_id: debtId,
      action: "payment_voided",
      old_data: debt,
      new_data: { status: "PENDENTE" },
      description: `Pagamento da dívida "${debt.title}" desfeito sem apagar o histórico.`,
    });
    revalidateCash();
    return { ok: true, message: "Pagamento desfeito. A dívida voltou para pendente e o valor retornou ao caixa." };
  } catch (error) {
    return fail(error, "Não foi possível desfazer o pagamento da dívida.");
  }
}

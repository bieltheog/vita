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
    if (!['ENTRADA','GASTO'].includes(entryType)) return { ok: false, error: "Escolha se é uma entrada ou gasto." };
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

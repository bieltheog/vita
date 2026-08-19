"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { registerPaymentAction } from "@/app/actions";
import { markInstallmentUnpaidAction } from "@/app/calendar-actions";

export type OperationResult = { ok: true; message?: string } | { ok: false; error: string };

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error && "message" in error) return String((error as {message?: unknown}).message || fallback);
  return fallback;
}

export async function registerPaymentSafeAction(formData: FormData): Promise<OperationResult> {
  try {
    await registerPaymentAction(formData);
    return { ok: true, message: "Pagamento registrado." };
  } catch (error) {
    return { ok: false, error: errorMessage(error, "Não foi possível registrar o pagamento.") };
  }
}

export async function markInstallmentUnpaidSafeAction(formData: FormData): Promise<OperationResult> {
  try {
    await markInstallmentUnpaidAction(formData);
    return { ok: true, message: "Pagamento desfeito sem apagar o histórico." };
  } catch (error) {
    return { ok: false, error: errorMessage(error, "Não foi possível desfazer o pagamento.") };
  }
}

export async function renegotiateInstallmentAction(formData: FormData): Promise<OperationResult> {
  try {
    const supabase = await createClient();
    if (!supabase) return { ok: false, error: "Ação indisponível no modo demonstração." };
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Sessão inválida." };

    const installmentId = String(formData.get("installment_id") || "").trim();
    const dueDate = String(formData.get("new_due_date") || "").trim();
    const amount = Number(String(formData.get("new_amount") || "0").replace(",", "."));
    const reason = String(formData.get("reason") || "").trim();
    if (!installmentId || !dueDate || amount <= 0) return { ok: false, error: "Informe a parcela, a nova data e o novo valor." };

    const { data, error } = await supabase.rpc("renegotiate_installment", {
      p_installment_id: installmentId,
      p_new_due_date: dueDate,
      p_new_amount: amount,
      p_reason: reason || null,
    });
    if (error) return { ok: false, error: error.message };

    const payload = data as { client_id?: string; loan_id?: string } | null;
    ["/dashboard", "/cobrancas-hoje", "/calendario", "/pagamentos", "/emprestimos", "/fluxo-caixa", "/relatorios", "/fechamento-diario"]
      .forEach((path) => revalidatePath(path));
    if (payload?.client_id) revalidatePath(`/clientes/${payload.client_id}`);
    if (payload?.loan_id) revalidatePath(`/emprestimos/${payload.loan_id}`);
    return { ok: true, message: "Parcela renegociada e calendário atualizado." };
  } catch (error) {
    return { ok: false, error: errorMessage(error, "Não foi possível renegociar a parcela.") };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type FinalizeLoanResult = { ok: true } | { ok: false; error: string };

function readableError(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = String((error as { message?: unknown }).message || "").trim();
    if (message) return message;
  }
  return "Não foi possível finalizar o empréstimo.";
}

export async function finalizeLoanAction(formData: FormData): Promise<FinalizeLoanResult> {
  try {
    const supabase = await createClient();
    if (!supabase) throw new Error("Ação indisponível. Configure o Supabase.");
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Sessão inválida.");

    const loanId = String(formData.get("loan_id") || "").trim();
    if (!loanId) throw new Error("Empréstimo não identificado.");

    const { data: loan, error: findError } = await supabase
      .from("loans")
      .select("id,loan_code,client_id,status")
      .eq("id", loanId)
      .eq("user_id", user.id)
      .single();
    if (findError || !loan) throw findError || new Error("Empréstimo não encontrado.");

    if (loan.status === "FINALIZADO") return { ok: true };
    if (loan.status === "CANCELADO") throw new Error("Um empréstimo cancelado não pode ser finalizado.");

    const [{ data: installments, error: installmentsError }, { count: paymentCount, error: paymentsError }] = await Promise.all([
      supabase
        .from("installments")
        .select("remaining_amount,stored_status")
        .eq("loan_id", loanId)
        .eq("user_id", user.id),
      supabase
        .from("payments")
        .select("id", { count: "exact", head: true })
        .eq("loan_id", loanId)
        .eq("user_id", user.id)
        .is("voided_at", null),
    ]);
    if (installmentsError) throw installmentsError;
    if (paymentsError) throw paymentsError;

    const remainingBalance = (installments || [])
      .filter(row => row.stored_status !== "CANCELADO")
      .reduce((sum, row) => sum + Number(row.remaining_amount || 0), 0);

    // Finalizar altera somente o estado da operação. Pagamentos, parcelas pagas
    // e seus comprovantes permanecem intactos como histórico financeiro.
    const { error: updateError } = await supabase
      .from("loans")
      .update({ status: "FINALIZADO", updated_at: new Date().toISOString() })
      .eq("id", loanId)
      .eq("user_id", user.id)
      .eq("status", "ATIVO");
    if (updateError) throw updateError;

    await supabase.from("activity_logs").insert({
      user_id: user.id,
      entity_type: "loan",
      entity_id: loanId,
      action: "finalized",
      old_data: { status: loan.status },
      new_data: {
        status: "FINALIZADO",
        remaining_balance_at_finalization: remainingBalance,
        preserved_payment_count: paymentCount || 0,
      },
      description: `Empréstimo ${loan.loan_code} finalizado sem alterar os pagamentos já registrados.`,
    });

    [
      "/dashboard", "/emprestimos", `/emprestimos/${loanId}`, "/pagamentos", "/calendario",
      "/cobrancas-hoje", "/fluxo-caixa", "/meu-caixa", "/relatorios", `/clientes/${loan.client_id}`,
    ].forEach(path => revalidatePath(path));

    return { ok: true };
  } catch (error) {
    console.error("finalizeLoanAction", error);
    return { ok: false, error: readableError(error) };
  }
}

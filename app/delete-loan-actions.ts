"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type DeleteLoanResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

function readableError(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = String((error as { message?: unknown }).message || "").trim();
    if (message) return message;
  }
  return "Não foi possível excluir o empréstimo.";
}

export async function deleteLoanAction(formData: FormData): Promise<DeleteLoanResult> {
  try {
    const supabase = await createClient();
    if (!supabase) throw new Error("Ação indisponível. Configure o Supabase.");

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Sessão inválida.");

    const loanId = String(formData.get("loan_id") || "").trim();
    const confirmation = String(formData.get("confirmation") || "").trim();
    if (!loanId) throw new Error("Empréstimo não encontrado.");
    if (!confirmation) throw new Error("Digite o código do empréstimo para confirmar.");

    const { data, error } = await supabase.rpc("delete_loan_permanently", {
      p_loan_id: loanId,
      p_confirmation: confirmation,
    });
    if (error) throw error;

    const result = (data || {}) as { loan_code?: string; payments_deleted?: number };
    const loanCode = result.loan_code || confirmation;
    const paymentsDeleted = Number(result.payments_deleted || 0);

    [
      "/dashboard", "/emprestimos", "/pagamentos", "/calendario", "/cobrancas-hoje",
      "/fechamento-diario", "/fluxo-caixa", "/meu-caixa", "/relatorios", "/clientes",
    ].forEach(path => revalidatePath(path));

    return {
      ok: true,
      message: paymentsDeleted > 0
        ? `${loanCode} excluído. ${paymentsDeleted} pagamento(s) ligado(s) a ele também foram removidos.`
        : `${loanCode} excluído permanentemente.`,
    };
  } catch (error) {
    console.error("deleteLoanAction", error);
    return { ok: false, error: readableError(error) };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CancelLoanResult = { ok: true } | { ok: false; error: string };

export async function cancelLoanAction(formData: FormData): Promise<CancelLoanResult> {
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

    if (loan.status === "CANCELADO") return { ok: true };
    if (loan.status === "FINALIZADO") throw new Error("Um empréstimo finalizado não pode ser cancelado.");

    // Somente o status do empréstimo é alterado. Nenhum pagamento ou parcela
    // já paga é editado/excluído; a camada financeira ignora o saldo futuro.
    const { error } = await supabase
      .from("loans")
      .update({ status: "CANCELADO", updated_at: new Date().toISOString() })
      .eq("id", loanId)
      .eq("user_id", user.id);
    if (error) throw error;

    await supabase.from("activity_logs").insert({
      user_id: user.id,
      entity_type: "loan",
      entity_id: loanId,
      action: "cancelled",
      old_data: { status: loan.status },
      new_data: { status: "CANCELADO" },
      description: `Empréstimo ${loan.loan_code} cancelado sem alterar pagamentos já realizados.`,
    });

    ["/dashboard", "/emprestimos", "/pagamentos", "/calendario", "/fluxo-caixa", "/relatorios", "/cobrancas-hoje", `/clientes/${loan.client_id}`]
      .forEach(path => revalidatePath(path));

    return { ok: true };
  } catch (error) {
    console.error("cancelLoanAction", error);
    return { ok: false, error: error instanceof Error ? error.message : "Não foi possível cancelar o empréstimo." };
  }
}

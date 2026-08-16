"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function authContext() {
  const supabase = await createClient();
  if (!supabase) throw new Error("Ação indisponível. Configure o Supabase.");
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Sessão inválida.");
  return { supabase, user };
}

export async function markInstallmentUnpaidAction(formData: FormData) {
  const { supabase, user } = await authContext();
  const installmentId = String(formData.get("installment_id") || "").trim();
  if (!installmentId) throw new Error("Parcela não identificada.");

  const { data: installment, error: installmentError } = await supabase
    .from("installments")
    .select("id,client_id,loan_id,installment_number,amount_paid")
    .eq("id", installmentId)
    .eq("user_id", user.id)
    .single();
  if (installmentError || !installment) throw installmentError || new Error("Parcela não encontrada.");

  const { data: activePayments, error: paymentsError } = await supabase
    .from("payments")
    .select("id,amount,payment_date,payment_method")
    .eq("installment_id", installmentId)
    .eq("user_id", user.id)
    .is("voided_at", null);
  if (paymentsError) throw paymentsError;
  if (!activePayments?.length) throw new Error("Esta parcela não possui pagamento ativo para desfazer.");

  const now = new Date().toISOString();
  const { error: voidError } = await supabase
    .from("payments")
    .update({ voided_at: now, void_reason: "Marcado como não pago pelo calendário" })
    .eq("installment_id", installmentId)
    .eq("user_id", user.id)
    .is("voided_at", null);
  if (voidError) throw voidError;

  await supabase.from("activity_logs").insert({
    user_id: user.id,
    entity_type: "installment",
    entity_id: installmentId,
    action: "payment_voided",
    old_data: { payments: activePayments, amount_paid: installment.amount_paid },
    new_data: { amount_paid: 0 },
    description: `Pagamentos da parcela ${installment.installment_number} foram desfeitos pelo calendário sem apagar o histórico.`,
  });

  ["/dashboard", "/pagamentos", "/calendario", "/fluxo-caixa", "/relatorios", `/clientes/${installment.client_id}`]
    .forEach((path) => revalidatePath(path));
}

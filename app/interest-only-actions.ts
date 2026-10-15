"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActivePortfolio } from "@/lib/portfolio";

export async function registerInterestOnlyAction(formData: FormData) {
  const supabase = await createClient();
  if (!supabase) throw new Error("Operação indisponível em modo demonstração.");
  const {data:{user}} = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão inválida.");
  const installmentId=String(formData.get("installment_id")||"").trim();
  const paymentDate=String(formData.get("payment_date")||"").trim();
  const method=String(formData.get("payment_method")||"PIX");
  const notes=String(formData.get("notes")||"");
  if(!installmentId||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(paymentDate))
    throw new Error("Informe a parcela e uma data válida.");
  const {data:inst,error:e1}=await supabase.from("installments").select("id,loan_id")
    .eq("id",installmentId).eq("user_id",user.id).single();
  if(e1||!inst)throw e1||new Error("Parcela não encontrada.");
  const {data:loan,error:e2}=await supabase.from("loans").select("portfolio_id")
    .eq("id",inst.loan_id).eq("user_id",user.id).single();
  if(e2||!loan||loan.portfolio_id!==(await getActivePortfolio()))
    throw new Error("Esta parcela não pertence à carteira selecionada.");
  const {error}=await supabase.rpc("register_interest_only_payment",{
    p_installment_id:installmentId,
    p_payment_date:paymentDate,
    p_payment_method:method,
    p_notes:notes||null,
  });
  if(error)throw new Error(error.message);
  ["/dashboard","/emprestimos","/pagamentos","/calendario","/relatorios","/carteiras","/cobrancas-hoje"]
    .forEach(p=>revalidatePath(p));
  revalidatePath("/emprestimos/"+inst.loan_id);
}

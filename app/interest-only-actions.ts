"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActivePortfolio } from "@/lib/portfolio";

export type InterestOnlyResult = { ok: true; message?: string } | { ok: false; error: string };

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message=String((error as {message?:unknown}).message||"").trim();
    if(message)return message;
  }
  return fallback;
}

function revalidateInterestPaths(loanId?: string, clientId?: string) {
  ["/dashboard","/emprestimos","/pagamentos","/calendario","/relatorios","/carteiras","/cobrancas-hoje","/fluxo-caixa","/meu-caixa","/fechamento-diario"]
    .forEach(p=>revalidatePath(p));
  if(loanId)revalidatePath("/emprestimos/"+loanId);
  if(clientId)revalidatePath("/clientes/"+clientId);
}

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

  const {data:inst,error:e1}=await supabase.from("installments").select("id,loan_id,client_id")
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

  revalidateInterestPaths(inst.loan_id,inst.client_id);
}

export async function voidInterestOnlyAction(formData: FormData): Promise<InterestOnlyResult> {
  try {
    const supabase=await createClient();
    if(!supabase)return {ok:false,error:"Operação indisponível em modo demonstração."};
    const {data:{user},error:authError}=await supabase.auth.getUser();
    if(authError||!user)return {ok:false,error:"Sessão inválida."};

    const paymentId=String(formData.get("payment_id")||"").trim();
    const reason=String(formData.get("reason")||"").trim();
    if(!paymentId)return {ok:false,error:"Pagamento de juros não identificado."};

    const {data:payment,error:paymentError}=await supabase
      .from("payments")
      .select("id,loan_id,client_id,payment_kind,voided_at")
      .eq("id",paymentId)
      .eq("user_id",user.id)
      .maybeSingle();
    if(paymentError)throw paymentError;
    if(!payment||payment.payment_kind!=="JUROS"||payment.voided_at)
      return {ok:false,error:"Pagamento de juros ativo não encontrado."};

    const {data:loan,error:loanError}=await supabase
      .from("loans")
      .select("id,portfolio_id")
      .eq("id",payment.loan_id)
      .eq("user_id",user.id)
      .maybeSingle();
    if(loanError)throw loanError;
    if(!loan||loan.portfolio_id!==(await getActivePortfolio()))
      return {ok:false,error:"Este pagamento pertence a outra carteira."};

    const {data,error}=await supabase.rpc("void_interest_only_payment",{
      p_payment_id:paymentId,
      p_reason:reason||null,
    });
    if(error)return {ok:false,error:error.message};

    const payload=data as {loan_id?:string;client_id?:string}|null;
    revalidateInterestPaths(payload?.loan_id||payment.loan_id,payload?.client_id||payment.client_id);
    return {
      ok:true,
      message:"Juros estornados. A parcela original foi reaberta e a parcela criada pela renovação foi cancelada.",
    };
  } catch(error) {
    return {ok:false,error:errorMessage(error,"Não foi possível estornar o pagamento de juros.")};
  }
}

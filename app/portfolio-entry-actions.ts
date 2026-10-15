"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActivePortfolio } from "@/lib/portfolio";
import { brazilDateKey } from "@/lib/date";

const TYPES = ["APORTE","CREDITO","AMORTIZACAO_DIVIDA","JUROS_FINANCIAMENTO","RETIRADA","DESPESA","PERDA","RECUPERACAO","OUTRA_ENTRADA","OUTRA_SAIDA"];
export async function registerPortfolioEntryAction(formData:FormData){
  const supabase=await createClient();
  if(!supabase)throw new Error("Supabase não configurado");
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error("Sessão inválida");
  const kind=String(formData.get("kind")||"");
  const amount=Number(formData.get("amount"));
  const entry_date=String(formData.get("entry_date")||"");
  const description=String(formData.get("description")||"").trim();
  const loan_id=String(formData.get("loan_id")||"").trim()||null;
  const portfolio_id=await getActivePortfolio();
  if(!TYPES.includes(kind))throw new Error("Tipo inválido");
  if(!Number.isFinite(amount)||amount<=0)throw new Error("Valor inválido");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(entry_date))throw new Error("Data inválida");
  if(!description)throw new Error("Informe a origem ou o destino do dinheiro");
  if(["PERDA","RECUPERACAO"].includes(kind)&&!loan_id)throw new Error("Selecione um empréstimo para registrar perda ou reversão.");
  if(loan_id){
    const {data:loan,error}=await supabase.from("loans").select("id").eq("id",loan_id)
      .eq("portfolio_id",portfolio_id).eq("user_id",user.id).single();
    if(error||!loan)throw new Error("Contrato não pertence à carteira selecionada");
  }
  if(["AMORTIZACAO_DIVIDA","JUROS_FINANCIAMENTO"].includes(kind)&&!description.trim())throw new Error("Identifique o contrato da dívida.");
  const {error}=await supabase.from("portfolio_entries").insert({
    user_id:user.id,portfolio_id,kind,amount,entry_date,description,loan_id
  });
  if(error)throw new Error(error.message);
  revalidatePath("/carteiras");
  revalidatePath("/dashboard");
  revalidatePath("/relatorios");
}

export async function voidPortfolioEntryAction(formData:FormData){
  const supabase=await createClient();
  if(!supabase)throw new Error("Supabase não configurado");
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error("Sessão inválida");
  const id=String(formData.get("entry_id")||"");
  if(!id)throw new Error("Lançamento não informado");
  const {data,error}=await supabase.from("portfolio_entries").update({
    voided_at:new Date().toISOString(),void_reason:"Estorno solicitado pelo operador"
  }).eq("id",id).eq("user_id",user.id).eq("portfolio_id",await getActivePortfolio())
    .is("voided_at",null).select("id").maybeSingle();
  if(error||!data)throw new Error(error?.message||"Lançamento inexistente ou já estornado");
  revalidatePath("/carteiras");
  revalidatePath("/dashboard");
}

/**
 * Saldo físico disponível no COMEÇO do dia de corte.
 * Não é um novo aporte: os movimentos de datas anteriores são ignorados
 * no saldo atual e continuam íntegros no histórico.
 */
export async function registerOpeningBalanceAction(formData:FormData){
  const supabase=await createClient();
  if(!supabase)throw new Error("Supabase não configurado");
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)throw new Error("Sessão inválida");
  const portfolio_id=await getActivePortfolio();
  const opening_balance=Number(formData.get("opening_balance"));
  const start_date=String(formData.get("start_date")||"");
  const notes=String(formData.get("notes")||"").trim();
  if(!Number.isFinite(opening_balance)||opening_balance<0||Math.round(opening_balance*100)!==opening_balance*100&&Math.abs(Math.round(opening_balance*100)-opening_balance*100)>.00001)
    throw new Error("Informe um saldo inicial válido com no máximo dois centavos decimais.");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start_date)||start_date>brazilDateKey())
    throw new Error("Informe uma data válida que não seja futura.");
  const {data:existing,error:checkError}=await supabase.from("portfolio_cash_baselines")
    .select("portfolio_id").eq("user_id",user.id).eq("portfolio_id",portfolio_id).maybeSingle();
  if(checkError)throw checkError;
  if(existing)throw new Error("Esta carteira já possui um saldo de abertura. Use entradas e saídas de ajuste para registrar alterações.");
  const {error}=await supabase.from("portfolio_cash_baselines").insert({
    user_id:user.id,portfolio_id,start_date,opening_balance,notes:notes||null
  });
  if(error)throw new Error(error.message);
  await supabase.from("activity_logs").insert({
    user_id:user.id,entity_type:"portfolio_cash_baseline",action:"created",
    new_data:{portfolio_id,start_date,opening_balance,notes},
    description:`Saldo inicial da Carteira ${portfolio_id} registrado com data de corte ${start_date}.`
  });
  revalidatePath("/carteiras");revalidatePath("/dashboard");revalidatePath("/relatorios");
}

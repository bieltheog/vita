"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActivePortfolio } from "@/lib/portfolio";

const TYPES = ["APORTE","RETIRADA","DESPESA","PERDA","RECUPERACAO"];
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
  if(loan_id){
    const {data:loan,error}=await supabase.from("loans").select("id").eq("id",loan_id)
      .eq("portfolio_id",portfolio_id).eq("user_id",user.id).single();
    if(error||!loan)throw new Error("Contrato não pertence à carteira selecionada");
  }
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

"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function switchPortfolioAction(value: 1 | 2) {
  if (value !== 1 && value !== 2) throw new Error("Carteira inválida");
  const supabase = await createClient();
  if (supabase) {
    const {data:{user}} = await supabase.auth.getUser();
    if (!user) throw new Error("Sessão inválida");
  }
  (await cookies()).set("jureminha_portfolio",String(value),{
    httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/"
  });
  revalidatePath("/", "layout");
}

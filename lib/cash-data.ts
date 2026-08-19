import { createClient } from "@/lib/supabase/server";
import type { CashAccount, CashEntry } from "@/lib/types";

export async function getCashAccount(): Promise<CashAccount | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("cash_accounts")
    .select("user_id,opening_balance,reserve_amount,tracking_start_date,created_at,updated_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data as CashAccount | null;
}

export async function getCashEntries(): Promise<CashEntry[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("cash_entries")
    .select("id,user_id,entry_type,category,amount,entry_date,description,voided_at,created_at")
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as CashEntry[];
}

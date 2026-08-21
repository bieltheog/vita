import { createClient } from "@/lib/supabase/server";
import type { CashAccount, CashDebt, CashEntry, LoanTopup } from "@/lib/types";

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

export async function getCashDebts(): Promise<CashDebt[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("cash_debts")
    .select("id,user_id,title,amount,due_date,status,notes,paid_at,payment_date,cash_entry_id,created_at,updated_at")
    .order("due_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as CashDebt[];
}

export async function getLoanTopups(loanId?: string): Promise<LoanTopup[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  let query = supabase
    .from("loan_topups")
    .select("id,user_id,loan_id,client_id,amount,calculation_type,return_value,expected_profit,total_receivable_added,topup_date,previous_remaining,new_remaining,future_installment_count,payment_frequency,first_due_date,notes,created_at,client:clients(id,name),loan:loans(id,loan_code)")
    .order("topup_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (loanId) query = query.eq("loan_id", loanId);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as LoanTopup[];
}

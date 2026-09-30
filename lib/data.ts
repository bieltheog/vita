import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { demoClients, demoInstallments, demoLoans, demoPayments } from "@/lib/demo-data";
import { effectiveInstallmentStatus } from "@/lib/finance";
import { brazilDateKey } from "@/lib/date";
import type { ActivityLog, Client, DashboardSummary, Installment, Loan, LoanTopup, Payment } from "@/lib/types";

export async function getCurrentProfile() {
  const supabase = await createClient();
  if (!supabase) return { id: "demo", full_name: "Usuário", email: "demo@jureminha.local", demo: true };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("id,full_name,email,avatar_url").eq("id", user.id).maybeSingle();
  return { id: user.id, full_name: profile?.full_name || user.user_metadata?.full_name || "Usuário", email: profile?.email || user.email, avatar_url: profile?.avatar_url, demo: false };
}

export async function getClients(): Promise<Client[]> {
  const supabase = await createClient();
  if (!supabase) return demoClients;
  const { data, error } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as Client[];
}

export async function getClient(id: string) {
  const supabase = await createClient();
  if (!supabase) return demoClients.find((item) => item.id === id) || null;
  const { data, error } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Client | null;
}

export async function getLoans(clientId?: string): Promise<Loan[]> {
  const supabase = await createClient();
  if (!supabase) return clientId ? demoLoans.filter((loan) => loan.client_id === clientId) : demoLoans;
  let query = supabase.from("loans").select("*, client:clients(id,name,phone,whatsapp)").order("created_at", { ascending: false });
  if (clientId) query = query.eq("client_id", clientId);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as Loan[];
}

export async function getLoan(id: string): Promise<Loan | null> {
  const supabase = await createClient();
  if (!supabase) return demoLoans.find((loan) => loan.id === id) || null;
  const { data, error } = await supabase.from("loans").select("*, client:clients(id,name,phone,whatsapp)").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as unknown as Loan | null;
}

export async function getInstallments(options?: { clientId?: string; loanId?: string; from?: string; to?: string; includeInactive?: boolean }): Promise<Installment[]> {
  const supabase = await createClient();
  if (!supabase) {
    const inactiveIds = new Set(demoLoans.filter((loan) => loan.status !== "ATIVO").map((loan) => loan.id));
    return demoInstallments.filter((row) =>
      (!options?.clientId || row.client_id === options.clientId) &&
      (!options?.loanId || row.loan_id === options.loanId) &&
      (!options?.from || row.due_date >= options.from) &&
      (!options?.to || row.due_date <= options.to) &&
      (Boolean(options?.loanId) || Boolean(options?.includeInactive) || !inactiveIds.has(row.loan_id))
    );
  }
  let query = supabase.from("installments").select("*, client:clients(id,name,phone,whatsapp), loan:loans(id,loan_code,installment_count,principal_amount,total_receivable,expected_profit,status)").order("due_date", { ascending: true });
  if (options?.clientId) query = query.eq("client_id", options.clientId);
  if (options?.loanId) query = query.eq("loan_id", options.loanId);
  if (options?.from) query = query.gte("due_date", options.from);
  if (options?.to) query = query.lte("due_date", options.to);
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data || []) as unknown as Installment[];
  // Somente operações ativas participam de saldo, cobrança e calendário. Ao abrir
  // diretamente um empréstimo finalizado/cancelado, o histórico continua visível.
  if (options?.loanId || options?.includeInactive) return rows;
  return rows.filter((row) => (row.loan as unknown as { status?: string } | undefined)?.status === "ATIVO");
}

export async function getHistoricalInstallments(options?: { clientId?: string; from?: string; to?: string }): Promise<Installment[]> {
  const [rows, loans] = await Promise.all([
    getInstallments({ ...options, includeInactive: true }),
    getLoans(options?.clientId),
  ]);
  const validLoanIds = new Set(loans.filter((loan) => loan.status !== "CANCELADO").map((loan) => loan.id));
  return rows.filter((row) => row.stored_status !== "CANCELADO" && validLoanIds.has(row.loan_id));
}

export async function getPayments(clientId?: string, loanId?: string): Promise<Payment[]> {
  const supabase = await createClient();
  if (!supabase) {
    return demoPayments.filter((p) =>
      (!clientId || p.client_id === clientId) &&
      (!loanId || p.loan_id === loanId)
    );
  }
  let query = supabase.from("payments").select("*, client:clients(id,name,phone,whatsapp), loan:loans(id,loan_code,total_receivable,expected_profit,status)").is("voided_at", null).order("payment_date", { ascending: false });
  if (clientId) query = query.eq("client_id", clientId);
  if (loanId) query = query.eq("loan_id", loanId);
  const { data, error } = await query;
  if (error) throw error;
  // Pagamento recebido continua sendo histórico financeiro mesmo que o contrato
  // original seja cancelado depois por renegociação. Somente estornos (voided_at)
  // deixam de participar dos totais.
  return (data || []) as unknown as Payment[];
}

export async function getLoanTopups(loanId?: string): Promise<LoanTopup[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  let query = supabase.from("loan_topups")
    .select("*, client:clients(id,name), loan:loans(id,loan_code)")
    .order("topup_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (loanId) query = query.eq("loan_id", loanId);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as LoanTopup[];
}

export async function getActivityLogs(limit = 200): Promise<ActivityLog[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("activity_logs").select("id,user_id,entity_type,entity_id,action,description,old_data,new_data,created_at").order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data || []) as ActivityLog[];
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const [loans, installments, historicalInstallments, payments] = await Promise.all([
    getLoans(),
    getInstallments(),
    getHistoricalInstallments(),
    getPayments(),
  ]);
  const today = brazilDateKey();
  const todayDate = parseISO(today);
  const weekStart = format(startOfWeek(todayDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(todayDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const monthStart = format(startOfMonth(todayDate), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(todayDate), "yyyy-MM-dd");
  const activeLoans = loans.filter((l) => l.status === "ATIVO");
  const activeClientIds = new Set(activeLoans.map((l) => l.client_id));
  const totalReceived = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  // Saldo atual considera somente empréstimos ativos.
  const outstanding = installments
    .filter((i) => i.stored_status !== "CANCELADO")
    .reduce((sum, i) => sum + Number(i.remaining_amount), 0);

  // Capital em circulação representa somente o principal que ainda está com os clientes.
  // Como cada recebimento mistura principal + lucro, o principal é amortizado na mesma
  // proporção em que o saldo total do empréstimo é recebido.
  const remainingByLoan = new Map<string, number>();
  for (const installment of installments) {
    if (installment.stored_status === "CANCELADO") continue;
    remainingByLoan.set(
      installment.loan_id,
      (remainingByLoan.get(installment.loan_id) || 0) + Number(installment.remaining_amount),
    );
  }
  const capitalCirculation = activeLoans.reduce((sum, loan) => {
    const principal = Number(loan.principal_amount);
    const totalReceivable = Number(loan.total_receivable);
    const remainingReceivable = Math.max(0, remainingByLoan.get(loan.id) || 0);
    if (principal <= 0 || totalReceivable <= 0) return sum;
    const outstandingRatio = Math.max(0, Math.min(1, remainingReceivable / totalReceivable));
    return sum + principal * outstandingRatio;
  }, 0);

  const expectedProfit = activeLoans.reduce((sum, l) => sum + Number(l.expected_profit), 0);

  // Previsto/quitado é histórico de agenda: contratos finalizados continuam aparecendo,
  // enquanto contratos/parcelas cancelados por renegociação não voltam para a conta.
  const todayRows = historicalInstallments.filter((i) => i.due_date === today);
  const receiveToday = todayRows.reduce((sum, i) => sum + Number(i.amount), 0);
  const pendingToday = todayRows.reduce((sum, i) => sum + Number(i.remaining_amount), 0);
  const receivedToday = payments
    .filter((p) => p.payment_date.slice(0, 10) === today)
    .reduce((sum, p) => sum + Number(p.amount), 0);

  // Atraso é sempre posição atual: apenas saldo remanescente de empréstimos ativos.
  const overdue = installments
    .filter((i) => i.stored_status !== "CANCELADO" && Number(i.remaining_amount) > 0 && i.due_date < today)
    .reduce((sum, i) => sum + Number(i.remaining_amount), 0);

  const weekExpected = historicalInstallments
    .filter((i) => i.due_date >= weekStart && i.due_date <= weekEnd)
    .reduce((sum, i) => sum + Number(i.amount), 0);
  const monthExpected = historicalInstallments
    .filter((i) => i.due_date >= monthStart && i.due_date <= monthEnd)
    .reduce((sum, i) => sum + Number(i.amount), 0);

  return {
    capitalCirculation,
    totalReceivable: outstanding,
    expectedProfit,
    totalReceived,
    receiveToday,
    receivedToday,
    pendingToday,
    overdue,
    activeClients: activeClientIds.size,
    weekExpected,
    monthExpected,
  };
}

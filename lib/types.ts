export type PaymentStatus = "PENDENTE" | "PAGO" | "ATRASADO" | "PARCIAL" | "REAGENDADO" | "CANCELADO";
export type LoanStatus = "ATIVO" | "FINALIZADO" | "CANCELADO";

export interface Client {
  id: string;
  user_id?: string;
  name: string;
  cpf?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  birth_date?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipcode?: string | null;
  profession?: string | null;
  photo_url?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface Loan {
  id: string;
  user_id?: string;
  client_id: string;
  loan_code: string;
  principal_amount: number;
  return_percentage: number | null;
  fixed_return_amount?: number | null;
  expected_profit: number;
  total_receivable: number;
  payment_frequency: string;
  installment_count: number;
  start_date: string;
  first_due_date: string;
  status: LoanStatus;
  created_at: string;
  client?: Pick<Client, "id" | "name"> | null;
}

export interface Installment {
  id: string;
  user_id?: string;
  loan_id: string;
  client_id: string;
  installment_number: number;
  due_date: string;
  original_due_date: string;
  amount: number;
  amount_paid: number;
  remaining_amount: number;
  stored_status: PaymentStatus;
  paid_at?: string | null;
  client?: Pick<Client, "id" | "name"> | null;
  loan?: Pick<Loan, "id" | "loan_code" | "installment_count"> | null;
}

export interface Payment {
  id: string;
  user_id?: string;
  client_id: string;
  loan_id: string;
  installment_id: string | null;
  amount: number;
  payment_date: string;
  payment_method: string;
  notes?: string | null;
  voided_at?: string | null;
  created_at: string;
  client?: Pick<Client, "id" | "name"> | null;
  loan?: Pick<Loan, "id" | "loan_code"> | null;
}

export interface DashboardSummary {
  capitalCirculation: number;
  totalReceivable: number;
  expectedProfit: number;
  totalReceived: number;
  receiveToday: number;
  receivedToday: number;
  pendingToday: number;
  overdue: number;
  activeClients: number;
  weekExpected: number;
  monthExpected: number;
}

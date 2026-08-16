import { format, addDays, subDays } from "date-fns";
import type { Client, Installment, Loan, Payment } from "@/lib/types";

const today = new Date();
const d = (offset: number) => format(addDays(today, offset), "yyyy-MM-dd");
const past = (offset: number) => format(subDays(today, offset), "yyyy-MM-dd");

export const demoClients: Client[] = [
  { id: "c1", name: "João Silva", cpf: "***.***.***-01", phone: "(11) 99999-1001", whatsapp: "(11) 99999-1001", email: "joao@exemplo.com", city: "São Paulo", state: "SP", profession: "Comerciante", created_at: past(120) },
  { id: "c2", name: "Carlos Santos", cpf: "***.***.***-02", phone: "(21) 99999-1002", whatsapp: "(21) 99999-1002", email: "carlos@exemplo.com", city: "Rio de Janeiro", state: "RJ", profession: "Autônomo", created_at: past(90) },
  { id: "c3", name: "Pedro Lima", cpf: "***.***.***-03", phone: "(31) 99999-1003", whatsapp: "(31) 99999-1003", email: "pedro@exemplo.com", city: "Belo Horizonte", state: "MG", profession: "Técnico", created_at: past(60) },
  { id: "c4", name: "Marina Costa", cpf: "***.***.***-04", phone: "(85) 99999-1004", whatsapp: "(85) 99999-1004", email: "marina@exemplo.com", city: "Fortaleza", state: "CE", profession: "Designer", created_at: past(45) },
];

export const demoLoans: Loan[] = [
  { id: "l1", client_id: "c1", loan_code: "EMP-0001", principal_amount: 2000, return_percentage: 30, expected_profit: 600, total_receivable: 2600, payment_frequency: "SEMANAL", installment_count: 5, start_date: past(28), first_due_date: past(21), status: "ATIVO", created_at: past(28), client: { id: "c1", name: "João Silva" } },
  { id: "l2", client_id: "c2", loan_code: "EMP-0002", principal_amount: 3500, return_percentage: 25, expected_profit: 875, total_receivable: 4375, payment_frequency: "QUINZENAL", installment_count: 5, start_date: past(50), first_due_date: past(35), status: "ATIVO", created_at: past(50), client: { id: "c2", name: "Carlos Santos" } },
  { id: "l3", client_id: "c3", loan_code: "EMP-0003", principal_amount: 1200, return_percentage: 20, expected_profit: 240, total_receivable: 1440, payment_frequency: "MENSAL", installment_count: 3, start_date: past(20), first_due_date: d(0), status: "ATIVO", created_at: past(20), client: { id: "c3", name: "Pedro Lima" } },
  { id: "l4", client_id: "c4", loan_code: "EMP-0004", principal_amount: 5000, return_percentage: 35, expected_profit: 1750, total_receivable: 6750, payment_frequency: "MENSAL", installment_count: 5, start_date: past(10), first_due_date: d(5), status: "ATIVO", created_at: past(10), client: { id: "c4", name: "Marina Costa" } },
];

export const demoInstallments: Installment[] = [
  { id: "i1", loan_id: "l1", client_id: "c1", installment_number: 1, due_date: past(21), original_due_date: past(21), amount: 520, amount_paid: 520, remaining_amount: 0, stored_status: "PAGO", paid_at: past(21), client: { id: "c1", name: "João Silva" }, loan: { id: "l1", loan_code: "EMP-0001", installment_count: 5 } },
  { id: "i2", loan_id: "l1", client_id: "c1", installment_number: 2, due_date: past(14), original_due_date: past(14), amount: 520, amount_paid: 520, remaining_amount: 0, stored_status: "PAGO", paid_at: past(14), client: { id: "c1", name: "João Silva" }, loan: { id: "l1", loan_code: "EMP-0001", installment_count: 5 } },
  { id: "i3", loan_id: "l1", client_id: "c1", installment_number: 3, due_date: past(7), original_due_date: past(7), amount: 520, amount_paid: 300, remaining_amount: 220, stored_status: "PARCIAL", client: { id: "c1", name: "João Silva" }, loan: { id: "l1", loan_code: "EMP-0001", installment_count: 5 } },
  { id: "i4", loan_id: "l1", client_id: "c1", installment_number: 4, due_date: d(0), original_due_date: d(0), amount: 520, amount_paid: 0, remaining_amount: 520, stored_status: "PENDENTE", client: { id: "c1", name: "João Silva" }, loan: { id: "l1", loan_code: "EMP-0001", installment_count: 5 } },
  { id: "i5", loan_id: "l1", client_id: "c1", installment_number: 5, due_date: d(7), original_due_date: d(7), amount: 520, amount_paid: 0, remaining_amount: 520, stored_status: "PENDENTE", client: { id: "c1", name: "João Silva" }, loan: { id: "l1", loan_code: "EMP-0001", installment_count: 5 } },
  { id: "i6", loan_id: "l2", client_id: "c2", installment_number: 3, due_date: past(4), original_due_date: past(4), amount: 875, amount_paid: 0, remaining_amount: 875, stored_status: "PENDENTE", client: { id: "c2", name: "Carlos Santos" }, loan: { id: "l2", loan_code: "EMP-0002", installment_count: 5 } },
  { id: "i7", loan_id: "l2", client_id: "c2", installment_number: 4, due_date: d(11), original_due_date: d(11), amount: 875, amount_paid: 0, remaining_amount: 875, stored_status: "PENDENTE", client: { id: "c2", name: "Carlos Santos" }, loan: { id: "l2", loan_code: "EMP-0002", installment_count: 5 } },
  { id: "i8", loan_id: "l3", client_id: "c3", installment_number: 1, due_date: d(0), original_due_date: d(0), amount: 480, amount_paid: 0, remaining_amount: 480, stored_status: "PENDENTE", client: { id: "c3", name: "Pedro Lima" }, loan: { id: "l3", loan_code: "EMP-0003", installment_count: 3 } },
  { id: "i9", loan_id: "l3", client_id: "c3", installment_number: 2, due_date: d(30), original_due_date: d(30), amount: 480, amount_paid: 0, remaining_amount: 480, stored_status: "PENDENTE", client: { id: "c3", name: "Pedro Lima" }, loan: { id: "l3", loan_code: "EMP-0003", installment_count: 3 } },
  { id: "i10", loan_id: "l4", client_id: "c4", installment_number: 1, due_date: d(5), original_due_date: d(5), amount: 1350, amount_paid: 0, remaining_amount: 1350, stored_status: "PENDENTE", client: { id: "c4", name: "Marina Costa" }, loan: { id: "l4", loan_code: "EMP-0004", installment_count: 5 } },
];

export const demoPayments: Payment[] = [
  { id: "p1", client_id: "c1", loan_id: "l1", installment_id: "i1", amount: 520, payment_date: past(21), payment_method: "PIX", created_at: past(21), client: { id: "c1", name: "João Silva" }, loan: { id: "l1", loan_code: "EMP-0001" } },
  { id: "p2", client_id: "c1", loan_id: "l1", installment_id: "i2", amount: 520, payment_date: past(14), payment_method: "PIX", created_at: past(14), client: { id: "c1", name: "João Silva" }, loan: { id: "l1", loan_code: "EMP-0001" } },
  { id: "p3", client_id: "c1", loan_id: "l1", installment_id: "i3", amount: 300, payment_date: past(5), payment_method: "DINHEIRO", created_at: past(5), client: { id: "c1", name: "João Silva" }, loan: { id: "l1", loan_code: "EMP-0001" } },
];

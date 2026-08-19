import type { PaymentStatus } from "@/lib/types";

const map: Record<PaymentStatus, { label: string; color: string }> = {
  PAGO: { label: "Pago", color: "green" },
  PENDENTE: { label: "Pendente", color: "yellow" },
  ATRASADO: { label: "Atrasado", color: "red" },
  PARCIAL: { label: "Parcial", color: "orange" },
  REAGENDADO: { label: "Reagendado", color: "blue" },
  CANCELADO: { label: "Cancelado", color: "gray" },
};

export function StatusBadge({ status }: { status: PaymentStatus | string }) {
  const item = map[status as PaymentStatus] || { label: status || "Status", color: "gray" };
  return <span className={`badge ${item.color}`}>{item.label}</span>;
}

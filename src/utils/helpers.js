export const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export const weekDays = [
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function formatDateBR(dateString) {
  if (!dateString) return "-";

  const [year, month, day] = String(dateString).split("-");

  if (!year || !month || !day) return dateString;

  return `${day}/${month}/${year}`;
}
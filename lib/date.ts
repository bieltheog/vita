export function brazilDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function brazilDateTime(date = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

/** "2026-11-03" (ou ISO com horário) → "03/11/2026". Valores fora do padrão voltam sem mudança. */
export function formatDateBR(value?: string | null) {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

/** Data curta e relativa a hoje: "Hoje", "Amanhã", "Ontem" ou "05/11". */
export function formatDayRelative(value: string, today = brazilDateKey()) {
  const day = (key: string) => Date.parse(`${key.slice(0, 10)}T12:00:00Z`);
  const diff = Math.round((day(value) - day(today)) / 86400000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  if (diff === -1) return "Ontem";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}` : value;
}

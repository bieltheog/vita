import { money, formatDateBR } from "../utils/helpers";

export default function LatePayments({ delayedEvents }) {
  return (
    <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-5">
      <h2 className="text-2xl font-bold mb-1">Pagamentos atrasados</h2>
      <p className="text-zinc-400 text-sm mb-5">
        Valores já calculados com multa configurada na conta do cliente.
      </p>

      <div className="space-y-4">
        {delayedEvents.map((event) => (
          <div
            key={event.id}
            className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-2xl bg-black/30 border border-red-500/20 p-4"
          >
            <div>
              <p className="font-bold text-lg">{event.nome}</p>
              <p className="text-red-200/70">
                Venceu em {formatDateBR(event.date)} · Base{" "}
                {money.format(event.baseValor)} · Multa{" "}
                {event.multaPercentual || 0}%
              </p>
            </div>

            <div className="text-2xl font-bold text-red-200">
              {money.format(event.valor)}
            </div>
          </div>
        ))}

        {delayedEvents.length === 0 && (
          <div className="text-zinc-500 text-center py-12">
            Nenhum pagamento atrasado.
          </div>
        )}
      </div>
    </div>
  );
}
import { money, formatDateBR } from "../utils/helpers";

export default function HistoryView({ records, onOpenProfile }) {
  const history = records.filter((item) => item.status === "Quitado");

  const totalEnviado = history.reduce((sum, item) => sum + Number(item.valorEnviado || 0), 0);
  const totalRecebido = history.reduce((sum, item) => sum + Number(item.valorReceber || 0), 0);
  const lucro = totalRecebido - totalEnviado;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <p className="text-sm text-zinc-400">Fichas quitadas</p>
          <h3 className="text-3xl font-bold mt-1">{history.length}</h3>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <p className="text-sm text-zinc-400">Total enviado</p>
          <h3 className="text-2xl font-bold mt-1">{money.format(totalEnviado)}</h3>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <p className="text-sm text-zinc-400">Total recebido</p>
          <h3 className="text-2xl font-bold mt-1 text-purple-200">{money.format(totalRecebido)}</h3>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-5">
          <p className="text-sm text-zinc-400">Lucro final</p>
          <h3 className="text-2xl font-bold mt-1 text-emerald-200">{money.format(lucro)}</h3>
        </div>
      </div>

      <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
        <h2 className="text-2xl font-bold mb-1">Histórico</h2>
        <p className="text-zinc-500 text-sm mb-5">
          Fichas marcadas como totalmente pagas ficam salvas aqui.
        </p>

        <div className="space-y-3">
          {history.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
            >
              <div>
                <p className="font-bold text-lg">{item.nome}</p>
                <p className="text-sm text-zinc-500">
                  {item.frequencia} · início {formatDateBR(item.dataInicio)}
                  {item.dataTermino ? ` · fim ${formatDateBR(item.dataTermino)}` : ""}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-zinc-500">Enviado</p>
                  <p>{money.format(item.valorEnviado)}</p>
                </div>

                <div>
                  <p className="text-zinc-500">Recebido</p>
                  <p className="text-purple-200">{money.format(item.valorReceber)}</p>
                </div>

                <div>
                  <p className="text-zinc-500">Lucro</p>
                  <p className="text-emerald-200">
                    {money.format(item.valorReceber - item.valorEnviado)}
                  </p>
                </div>
              </div>

              <button
                onClick={() => onOpenProfile(item)}
                className="rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-2 font-semibold"
              >
                Abrir ficha
              </button>
            </div>
          ))}

          {history.length === 0 && (
            <div className="text-center text-zinc-500 py-12">
              Nenhuma ficha quitada ainda.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
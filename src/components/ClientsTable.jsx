import { useMemo, useState } from "react";
import { StatusBadge } from "./ui";
import { money, formatDateBR } from "../utils/helpers";
import {
  calculateInstallment,
  calculateLateAmount,
} from "../utils/calculations";

export default function ClientsTable({
  filtered,
  search,
  setSearch,
  loading,
  onOpenProfile,
}) {
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [frequencyFilter, setFrequencyFilter] = useState("Todos");

  const visibleClients = useMemo(() => {
    return filtered.filter((item) => {
      const statusMatch = statusFilter === "Todos" || item.status === statusFilter;
      const frequencyMatch =
        frequencyFilter === "Todos" || item.frequencia === frequencyFilter;

      return statusMatch && frequencyMatch;
    });
  }, [filtered, statusFilter, frequencyFilter]);

  return (
    <div className="rounded-3xl shadow-sm border border-zinc-800 bg-zinc-950 text-white">
      <div className="p-5">
        <div className="flex flex-col gap-4 mb-5">
          <div>
            <h2 className="text-2xl font-bold">Clientes cadastrados</h2>
            <p className="text-sm text-zinc-500 mt-1">
              Abra a ficha para editar, encerrar ou excluir o cliente.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente..."
              className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 outline-none focus:border-purple-500"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 outline-none focus:border-purple-500"
            >
              <option>Todos</option>
              <option>Ativo</option>
              <option>Recebido</option>
              <option>Atrasado</option>
              <option>Quitado</option>
            </select>

            <select
              value={frequencyFilter}
              onChange={(e) => setFrequencyFilter(e.target.value)}
              className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 outline-none focus:border-purple-500"
            >
              <option>Todos</option>
              <option>Diário</option>
              <option>Semanal</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-zinc-500">
            Carregando clientes...
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {visibleClients.map((item) => {
              const parcela = calculateInstallment(item);
              const parcelaComMulta = calculateLateAmount(
                parcela,
                item.multaPercentual
              );

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 hover:border-purple-500/50 transition"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold">{item.nome}</h3>
                      <p className="text-sm text-zinc-500">
                        {item.whatsapp || "Sem WhatsApp"}
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        CPF: {item.cpf || "-"} · CEP: {item.cep || "-"}
                      </p>
                      <p className="text-xs text-zinc-500 max-w-md">
                        {item.endereco || "-"}, {item.numero || "-"} ·{" "}
                        {item.bairro || "-"} · {item.cidade || "-"}/
                        {item.estado || "-"}
                      </p>

                      <div className="mt-3">
                        <StatusBadge status={item.status} />
                      </div>
                    </div>

                    <button
                      onClick={() => onOpenProfile(item)}
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 transition font-semibold"
                    >
                      Abrir ficha
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 text-sm">
                    <div>
                      <p className="text-zinc-500">Enviado</p>
                      <p>{money.format(item.valorEnviado)}</p>
                    </div>

                    <div>
                      <p className="text-zinc-500">Receber</p>
                      <p className="text-purple-200 font-semibold">
                        {money.format(item.valorReceber)}
                      </p>
                    </div>

                    <div>
                      <p className="text-zinc-500">Parcela</p>
                      <p className="text-emerald-200">
                        {money.format(parcela)}
                      </p>
                    </div>

                    <div>
                      <p className="text-zinc-500">Atraso</p>
                      <p className="text-red-200">
                        {money.format(parcelaComMulta)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 text-xs text-zinc-500">
                    {item.frequencia} · início {formatDateBR(item.dataInicio)}
                    {item.frequencia === "Diário"
                      ? ` · fim ${formatDateBR(item.dataTermino)}`
                      : ` · ${item.semanas} semanas`}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && visibleClients.length === 0 && (
          <div className="text-center py-12 text-zinc-500">
            Nenhum cliente encontrado.
          </div>
        )}
      </div>
    </div>
  );
}
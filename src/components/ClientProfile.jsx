import { useMemo, useState } from "react";
import { StatusBadge } from "./ui";
import { money, formatDateBR } from "../utils/helpers";
import {
  calculateInstallment,
  calculateLateAmount,
  paymentTypes,
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

  function getFrequencyLabel(item) {
    if (item.frequencia === paymentTypes.FIXED_DATES) {
      return `Datas fixas: ${(item.diasPagamentoFixos || []).join(", ")}`;
    }

    if (item.frequencia === paymentTypes.CUSTOM) {
      return `${item.parcelasPersonalizadas?.length || 0} parcela(s) personalizadas`;
    }

    if (item.frequencia === paymentTypes.WEEKLY) {
      return `${item.semanas} semana(s)`;
    }

    return `Até ${formatDateBR(item.dataTermino)}`;
  }

  return (
    <div className="rounded-[2rem] shadow-2xl border border-zinc-800 bg-zinc-950 text-white overflow-hidden">
      <div className="p-4 md:p-6 border-b border-zinc-800 bg-gradient-to-r from-purple-950/30 to-transparent">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-purple-300 text-sm font-medium">Clientes</p>
            <h2 className="text-2xl md:text-3xl font-bold">
              Clientes cadastrados
            </h2>
            <p className="text-sm text-zinc-500 mt-1">
              Abra a ficha para editar, encerrar, criar novo empréstimo ou excluir.
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
              <option>{paymentTypes.DAILY}</option>
              <option>{paymentTypes.WEEKLY}</option>
              <option>{paymentTypes.FIXED_DATES}</option>
              <option>{paymentTypes.CUSTOM}</option>
            </select>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6">
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
                  className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-4 hover:border-purple-500/50 transition shadow-lg"
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-lg md:text-xl font-bold break-words">
                        {item.nome}
                      </h3>

                      <p className="text-sm text-zinc-500">
                        {item.whatsapp || "Sem WhatsApp"}
                      </p>

                      <p className="text-xs text-zinc-500 mt-1">
                        CPF: {item.cpf || "-"} · CEP: {item.cep || "-"}
                      </p>

                      <p className="text-xs text-zinc-500 max-w-md mt-1">
                        {item.endereco || "-"}, {item.numero || "-"} ·{" "}
                        {item.bairro || "-"} · {item.cidade || "-"}/
                        {item.estado || "-"}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <StatusBadge status={item.status} />

                        <span className="px-3 py-1 rounded-full text-xs border border-purple-500/20 bg-purple-600/10 text-purple-200">
                          {item.frequencia || "Sem conta"}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => onOpenProfile(item)}
                      className="px-4 py-3 md:py-2 rounded-xl bg-purple-600 hover:bg-purple-700 transition font-semibold shrink-0"
                    >
                      Abrir ficha
                    </button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 text-sm">
                    <div className="rounded-2xl border border-zinc-800 bg-black/20 p-3">
                      <p className="text-zinc-500">Enviado</p>
                      <p>{money.format(item.valorEnviado)}</p>
                    </div>

                    <div className="rounded-2xl border border-zinc-800 bg-black/20 p-3">
                      <p className="text-zinc-500">Receber</p>
                      <p className="text-purple-200 font-semibold">
                        {money.format(item.valorReceber)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-zinc-800 bg-black/20 p-3">
                      <p className="text-zinc-500">Parcela</p>
                      <p className="text-emerald-200">
                        {item.frequencia === paymentTypes.CUSTOM
                          ? "Variável"
                          : money.format(parcela)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-zinc-800 bg-black/20 p-3">
                      <p className="text-zinc-500">Atraso</p>
                      <p className="text-red-200">
                        {item.frequencia === paymentTypes.CUSTOM
                          ? `${item.multaPercentual || 0}%`
                          : money.format(parcelaComMulta)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 text-xs text-zinc-500">
                    {item.frequencia} · início {formatDateBR(item.dataInicio)} ·{" "}
                    {getFrequencyLabel(item)}
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
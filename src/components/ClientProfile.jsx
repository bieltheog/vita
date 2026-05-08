import { StatusBadge } from "./ui";
import { money, formatDateBR } from "../utils/helpers";
import {
  calculateInstallment,
  calculateLateAmount,
  buildCalendarEvents,
} from "../utils/calculations";

export default function ClientProfile({
  client,
  onBack,
  onEdit,
  onMarkRecordAsPaid,
  onNewLoan,
  onRemove,
}) {
  if (!client) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-white">
        <p className="text-zinc-400">Cliente não encontrado.</p>
        <button onClick={onBack} className="mt-4 rounded-xl bg-purple-600 px-4 py-2">
          Voltar
        </button>
      </div>
    );
  }

  const parcela = calculateInstallment(client);
  const parcelaComMulta = calculateLateAmount(parcela, client.multaPercentual);
  const eventos = buildCalendarEvents([client]);

  const pagos = eventos.filter((event) => event.statusPagamento === "Pago");
  const pendentes = eventos.filter((event) => event.statusPagamento === "Pendente");
  const atrasados = eventos.filter((event) => event.statusPagamento === "Atrasado");

  const historicoEmprestimos = client.historicoEmprestimos || [];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <button onClick={onBack} className="text-sm text-zinc-400 hover:text-white mb-4">
          ← Voltar para clientes
        </button>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold">{client.nome}</h2>

            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge status={client.status} />

              {client.status === "Quitado" && (
                <span className="px-3 py-1 rounded-full text-xs border border-emerald-500/30 bg-emerald-600/20 text-emerald-200">
                  Empréstimo atual quitado
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onEdit(client)}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 hover:border-purple-500 transition"
            >
              Editar ficha
            </button>

            {client.status !== "Quitado" && (
              <button
                onClick={() => onMarkRecordAsPaid(client.id)}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-3 font-semibold transition"
              >
                Marcar como totalmente pago
              </button>
            )}

            {client.status === "Quitado" && (
              <button
                onClick={() => onNewLoan(client.id)}
                className="rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-3 font-semibold transition"
              >
                Novo empréstimo
              </button>
            )}

            <button
              onClick={() => onRemove(client.id)}
              className="rounded-xl bg-red-600 hover:bg-red-700 px-4 py-3 font-semibold transition"
            >
              Excluir cliente
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h3 className="text-xl font-bold mb-4">Dados pessoais</h3>

          <div className="space-y-3 text-sm">
            <p><span className="text-zinc-500">WhatsApp:</span> {client.whatsapp || "-"}</p>
            <p><span className="text-zinc-500">CPF:</span> {client.cpf || "-"}</p>
            <p><span className="text-zinc-500">CEP:</span> {client.cep || "-"}</p>
            <p><span className="text-zinc-500">Endereço:</span> {client.endereco || "-"}, {client.numero || "-"}</p>
            <p><span className="text-zinc-500">Complemento:</span> {client.complemento || "-"}</p>
            <p><span className="text-zinc-500">Bairro:</span> {client.bairro || "-"}</p>
            <p><span className="text-zinc-500">Cidade/UF:</span> {client.cidade || "-"}/{client.estado || "-"}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h3 className="text-xl font-bold mb-4">Empréstimo atual</h3>

          {client.abrirConta && client.valorReceber > 0 ? (
            <div className="space-y-3 text-sm">
              <p><span className="text-zinc-500">Valor enviado:</span> {money.format(client.valorEnviado)}</p>
              <p><span className="text-zinc-500">% de retorno:</span> {client.porcentagemRetorno}%</p>
              <p>
                <span className="text-zinc-500">Valor a receber:</span>{" "}
                <strong className="text-purple-200">{money.format(client.valorReceber)}</strong>
              </p>
              <p><span className="text-zinc-500">Lucro previsto:</span> {money.format(client.valorReceber - client.valorEnviado)}</p>
              <p><span className="text-zinc-500">Pagamento:</span> {client.frequencia}</p>
              <p><span className="text-zinc-500">Início:</span> {formatDateBR(client.dataInicio)}</p>
              <p>
                <span className="text-zinc-500">Término:</span>{" "}
                {client.frequencia === "Diário"
                  ? formatDateBR(client.dataTermino)
                  : `${client.semanas} semanas`}
              </p>
              <p>
                <span className="text-zinc-500">Parcela:</span>{" "}
                <strong className="text-emerald-200">{money.format(parcela)}</strong>
              </p>
              <p>
                <span className="text-zinc-500">Com multa:</span>{" "}
                <strong className="text-red-200">{money.format(parcelaComMulta)}</strong>
              </p>
            </div>
          ) : (
            <p className="text-zinc-500">
              Nenhum empréstimo atual cadastrado. Clique em editar ficha para cadastrar.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h3 className="text-xl font-bold mb-4">Documentos</h3>

          <div className="space-y-2 text-sm">
            {client.anexos?.extrato?.url && (
              <a className="block text-purple-300 hover:underline" href={client.anexos.extrato.url} target="_blank" rel="noreferrer">
                Abrir extrato
              </a>
            )}

            {client.anexos?.comprovanteResidencia?.url && (
              <a className="block text-purple-300 hover:underline" href={client.anexos.comprovanteResidencia.url} target="_blank" rel="noreferrer">
                Abrir comprovante de residência
              </a>
            )}

            {client.anexos?.identidade?.url && (
              <a className="block text-purple-300 hover:underline" href={client.anexos.identidade.url} target="_blank" rel="noreferrer">
                Abrir identidade
              </a>
            )}

            {client.anexos?.outros?.url && (
              <a className="block text-purple-300 hover:underline" href={client.anexos.outros.url} target="_blank" rel="noreferrer">
                Abrir outros
              </a>
            )}

            {!client.anexos?.extrato?.url &&
              !client.anexos?.comprovanteResidencia?.url &&
              !client.anexos?.identidade?.url &&
              !client.anexos?.outros?.url && (
                <p className="text-zinc-500">Nenhum documento anexado.</p>
              )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <h3 className="text-xl font-bold mb-4">Resumo dos pagamentos do empréstimo atual</h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4">
            <p className="text-sm text-zinc-500">Total de parcelas</p>
            <p className="text-2xl font-bold">{eventos.length}</p>
          </div>

          <div className="rounded-2xl bg-emerald-950/20 border border-emerald-500/20 p-4">
            <p className="text-sm text-zinc-500">Pagas</p>
            <p className="text-2xl font-bold text-emerald-200">{pagos.length}</p>
          </div>

          <div className="rounded-2xl bg-yellow-950/20 border border-yellow-500/20 p-4">
            <p className="text-sm text-zinc-500">Pendentes</p>
            <p className="text-2xl font-bold text-yellow-200">{pendentes.length}</p>
          </div>

          <div className="rounded-2xl bg-red-950/20 border border-red-500/20 p-4">
            <p className="text-sm text-zinc-500">Atrasadas</p>
            <p className="text-2xl font-bold text-red-200">{atrasados.length}</p>
          </div>
        </div>

        <div className="space-y-3">
          {eventos.map((event) => (
            <div
              key={event.id}
              className={`rounded-xl border p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 ${
                event.statusPagamento === "Pago"
                  ? "bg-emerald-950/20 border-emerald-500/20"
                  : event.statusPagamento === "Atrasado"
                  ? "bg-red-950/20 border-red-500/20"
                  : "bg-zinc-900 border-zinc-800"
              }`}
            >
              <div>
                <p className="font-semibold">{formatDateBR(event.date)}</p>
                <p className="text-sm text-zinc-500">
                  {event.tipo} · {event.statusPagamento}
                </p>
              </div>

              <div className="font-bold text-purple-200">
                {money.format(event.valor)}
              </div>
            </div>
          ))}

          {eventos.length === 0 && (
            <p className="text-zinc-500 text-center py-8">
              Nenhum pagamento gerado para o empréstimo atual.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <h3 className="text-xl font-bold mb-4">Histórico de empréstimos anteriores</h3>

        <div className="space-y-3">
          {historicoEmprestimos.map((loan, index) => (
            <div
              key={`${loan.finalizadoEm}-${index}`}
              className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <p className="font-bold">Empréstimo #{index + 1}</p>
                  <p className="text-sm text-zinc-500">
                    Finalizado em {loan.finalizadoEm ? new Date(loan.finalizadoEm).toLocaleDateString("pt-BR") : "-"}
                  </p>
                  <p className="text-sm text-zinc-500">
                    {loan.frequencia} · início {formatDateBR(loan.dataInicio)}
                    {loan.dataTermino ? ` · fim ${formatDateBR(loan.dataTermino)}` : ""}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-zinc-500">Enviado</p>
                    <p>{money.format(loan.valorEnviado || 0)}</p>
                  </div>

                  <div>
                    <p className="text-zinc-500">Recebido</p>
                    <p className="text-purple-200">{money.format(loan.valorReceber || 0)}</p>
                  </div>

                  <div>
                    <p className="text-zinc-500">Lucro</p>
                    <p className="text-emerald-200">{money.format(loan.lucro || 0)}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {historicoEmprestimos.length === 0 && (
            <p className="text-zinc-500 text-center py-8">
              Nenhum empréstimo anterior salvo ainda.
            </p>
          )}
        </div>
      </div>

      {client.observacao && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h3 className="text-xl font-bold mb-3">Observações</h3>
          <p className="text-zinc-400">{client.observacao}</p>
        </div>
      )}
    </div>
  );
}
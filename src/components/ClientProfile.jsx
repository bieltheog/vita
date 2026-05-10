import { StatusBadge } from "./ui";
import { money, formatDateBR } from "../utils/helpers";
import {
  calculateInstallment,
  calculateLateAmount,
  buildCalendarEvents,
  paymentTypes,
  paymentStatuses,
} from "../utils/calculations";

function getStatusStyle(status) {
  if (status === paymentStatuses.PAID) {
    return "border-emerald-500/20 bg-emerald-950/20 text-emerald-200";
  }

  if (status === paymentStatuses.LATE) {
    return "border-red-500/20 bg-red-950/20 text-red-200";
  }

  if (status === paymentStatuses.PARTIAL) {
    return "border-blue-500/20 bg-blue-950/20 text-blue-200";
  }

  if (status === paymentStatuses.CANCELED) {
    return "border-zinc-700 bg-zinc-900/50 text-zinc-300";
  }

  if (status === paymentStatuses.RENEGOTIATED) {
    return "border-purple-500/20 bg-purple-950/20 text-purple-200";
  }

  return "border-yellow-500/20 bg-yellow-950/20 text-yellow-200";
}

function InfoCard({ title, value, subtitle, tone = "default" }) {
  const tones = {
    default: "border-zinc-800 bg-zinc-950",
    purple: "border-purple-500/20 bg-purple-950/20",
    green: "border-emerald-500/20 bg-emerald-950/20",
    red: "border-red-500/20 bg-red-950/20",
    blue: "border-blue-500/20 bg-blue-950/20",
  };

  return (
    <div className={`rounded-3xl border p-4 ${tones[tone] || tones.default}`}>
      <p className="text-sm text-zinc-500">{title}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {subtitle && <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>}
    </div>
  );
}

function getPaymentDescription(client) {
  if (!client.abrirConta || Number(client.valorReceber || 0) <= 0) {
    return "Sem empréstimo atual";
  }

  if (client.frequencia === paymentTypes.DAILY) {
    return `Diário · ${formatDateBR(client.dataInicio)} até ${formatDateBR(
      client.dataTermino
    )}`;
  }

  if (client.frequencia === paymentTypes.WEEKLY) {
    return `Semanal · ${client.semanas || 0} semana(s)`;
  }

  if (client.frequencia === paymentTypes.FIXED_DATES) {
    const dias = Array.isArray(client.diasPagamentoFixos)
      ? client.diasPagamentoFixos
      : [];

    return `Datas fixas · dias ${dias.join(", ") || "-"}`;
  }

  if (client.frequencia === paymentTypes.CUSTOM) {
    const parcelas = Array.isArray(client.parcelasPersonalizadas)
      ? client.parcelasPersonalizadas
      : [];

    return `Personalizado · ${parcelas.length} parcela(s)`;
  }

  return client.frequencia || "-";
}

function getLoanEndLabel(client) {
  if (client.frequencia === paymentTypes.WEEKLY) {
    return `${client.semanas || 0} semana(s)`;
  }

  if (client.frequencia === paymentTypes.CUSTOM) {
    const parcelas = Array.isArray(client.parcelasPersonalizadas)
      ? client.parcelasPersonalizadas
      : [];

    const validParcelas = parcelas.filter((item) => item && item.date);

    const last = validParcelas
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .at(-1);

    return last ? formatDateBR(last.date) : "-";
  }

  return formatDateBR(client.dataTermino);
}

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
        <button
          onClick={onBack}
          className="mt-4 rounded-xl bg-purple-600 px-4 py-2"
        >
          Voltar
        </button>
      </div>
    );
  }

  const safeClient = {
    ...client,
    diasPagamentoFixos: Array.isArray(client.diasPagamentoFixos)
      ? client.diasPagamentoFixos
      : [],
    parcelasPersonalizadas: Array.isArray(client.parcelasPersonalizadas)
      ? client.parcelasPersonalizadas
      : [],
    historicoEmprestimos: Array.isArray(client.historicoEmprestimos)
      ? client.historicoEmprestimos
      : [],
    pagamentos:
      client.pagamentos && typeof client.pagamentos === "object"
        ? client.pagamentos
        : {},
    anexos:
      client.anexos && typeof client.anexos === "object"
        ? client.anexos
        : {},
  };

  const parcela = calculateInstallment(safeClient);
  const parcelaComMulta = calculateLateAmount(
    parcela,
    safeClient.multaPercentual
  );

  const eventos = buildCalendarEvents([safeClient]) || [];

  const pagos = eventos.filter(
    (event) => event.statusPagamento === paymentStatuses.PAID
  );

  const pendentes = eventos.filter(
    (event) => event.statusPagamento === paymentStatuses.PENDING
  );

  const atrasados = eventos.filter(
    (event) => event.statusPagamento === paymentStatuses.LATE
  );

  const parciais = eventos.filter(
    (event) => event.statusPagamento === paymentStatuses.PARTIAL
  );

  const cancelados = eventos.filter(
    (event) => event.statusPagamento === paymentStatuses.CANCELED
  );

  const valorAberto = eventos.reduce(
    (sum, event) => sum + Number(event.saldo || event.valor || 0),
    0
  );

  const valorPagoParcial = eventos.reduce(
    (sum, event) => sum + Number(event.valorPago || 0),
    0
  );

  const historicoEmprestimos = safeClient.historicoEmprestimos;

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-zinc-800 bg-gradient-to-br from-purple-950/40 via-zinc-950 to-black p-5 md:p-6 shadow-2xl">
        <button
          onClick={onBack}
          className="text-sm text-zinc-400 hover:text-white mb-5"
        >
          ← Voltar para clientes
        </button>

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div>
            <p className="text-purple-300 text-sm font-medium">
              Ficha do cliente
            </p>

            <h2 className="text-3xl md:text-5xl font-black mt-1 break-words">
              {safeClient.nome}
            </h2>

            <p className="text-zinc-400 mt-2">
              {safeClient.whatsapp || "Sem WhatsApp"} · CPF{" "}
              {safeClient.cpf || "-"}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <StatusBadge status={safeClient.status} />

              <span className="px-3 py-1 rounded-full text-xs border border-purple-500/20 bg-purple-600/10 text-purple-200">
                {getPaymentDescription(safeClient)}
              </span>

              {safeClient.status === "Quitado" && (
                <span className="px-3 py-1 rounded-full text-xs border border-emerald-500/30 bg-emerald-600/20 text-emerald-200">
                  Empréstimo atual quitado
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onEdit(safeClient)}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 hover:border-purple-500 transition"
            >
              Editar ficha
            </button>

            {safeClient.status !== "Quitado" && (
              <button
                onClick={() => onMarkRecordAsPaid(safeClient.id)}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-3 font-semibold transition"
              >
                Marcar como totalmente pago
              </button>
            )}

            {safeClient.status === "Quitado" && (
              <button
                onClick={() => onNewLoan(safeClient.id)}
                className="rounded-xl bg-purple-600 hover:bg-purple-700 px-4 py-3 font-semibold transition"
              >
                Novo empréstimo
              </button>
            )}

            <button
              onClick={() => onRemove(safeClient.id)}
              className="rounded-xl bg-red-600 hover:bg-red-700 px-4 py-3 font-semibold transition"
            >
              Excluir cliente
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <InfoCard
          title="Valor enviado"
          value={money.format(safeClient.valorEnviado || 0)}
          subtitle="Empréstimo atual"
          tone="purple"
        />

        <InfoCard
          title="Valor a receber"
          value={money.format(safeClient.valorReceber || 0)}
          subtitle={`${safeClient.porcentagemRetorno || 0}% de retorno`}
          tone="green"
        />

        <InfoCard
          title="Em aberto"
          value={money.format(valorAberto)}
          subtitle="Saldo das parcelas atuais"
          tone="blue"
        />

        <InfoCard
          title="Pagamentos parciais"
          value={money.format(valorPagoParcial)}
          subtitle="Valor já recebido parcialmente"
          tone="default"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <h3 className="text-xl font-bold mb-4">Dados pessoais</h3>

          <div className="space-y-3 text-sm">
            <p>
              <span className="text-zinc-500">WhatsApp:</span>{" "}
              {safeClient.whatsapp || "-"}
            </p>

            <p>
              <span className="text-zinc-500">CPF:</span>{" "}
              {safeClient.cpf || "-"}
            </p>

            <p>
              <span className="text-zinc-500">CEP:</span>{" "}
              {safeClient.cep || "-"}
            </p>

            <p>
              <span className="text-zinc-500">Endereço:</span>{" "}
              {safeClient.endereco || "-"}, {safeClient.numero || "-"}
            </p>

            <p>
              <span className="text-zinc-500">Complemento:</span>{" "}
              {safeClient.complemento || "-"}
            </p>

            <p>
              <span className="text-zinc-500">Bairro:</span>{" "}
              {safeClient.bairro || "-"}
            </p>

            <p>
              <span className="text-zinc-500">Cidade/UF:</span>{" "}
              {safeClient.cidade || "-"}/{safeClient.estado || "-"}
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <h3 className="text-xl font-bold mb-4">Empréstimo atual</h3>

          {safeClient.abrirConta && Number(safeClient.valorReceber || 0) > 0 ? (
            <div className="space-y-3 text-sm">
              <p>
                <span className="text-zinc-500">Tipo:</span>{" "}
                {safeClient.frequencia}
              </p>

              <p>
                <span className="text-zinc-500">Valor enviado:</span>{" "}
                {money.format(safeClient.valorEnviado)}
              </p>

              <p>
                <span className="text-zinc-500">% de retorno:</span>{" "}
                {safeClient.porcentagemRetorno}%
              </p>

              <p>
                <span className="text-zinc-500">Valor a receber:</span>{" "}
                <strong className="text-purple-200">
                  {money.format(safeClient.valorReceber)}
                </strong>
              </p>

              <p>
                <span className="text-zinc-500">Lucro previsto:</span>{" "}
                {money.format(
                  Number(safeClient.valorReceber || 0) -
                    Number(safeClient.valorEnviado || 0)
                )}
              </p>

              <p>
                <span className="text-zinc-500">Início:</span>{" "}
                {formatDateBR(safeClient.dataInicio)}
              </p>

              <p>
                <span className="text-zinc-500">Término:</span>{" "}
                {getLoanEndLabel(safeClient)}
              </p>

              {safeClient.frequencia === paymentTypes.FIXED_DATES && (
                <p>
                  <span className="text-zinc-500">Dias fixos:</span>{" "}
                  {safeClient.diasPagamentoFixos.join(", ") || "-"}
                </p>
              )}

              {safeClient.frequencia === paymentTypes.CUSTOM ? (
                <p>
                  <span className="text-zinc-500">Parcelas:</span>{" "}
                  {safeClient.parcelasPersonalizadas.length} personalizada(s)
                </p>
              ) : (
                <>
                  <p>
                    <span className="text-zinc-500">Parcela:</span>{" "}
                    <strong className="text-emerald-200">
                      {money.format(parcela)}
                    </strong>
                  </p>

                  <p>
                    <span className="text-zinc-500">Com multa:</span>{" "}
                    <strong className="text-red-200">
                      {money.format(parcelaComMulta)}
                    </strong>
                  </p>
                </>
              )}
            </div>
          ) : (
            <p className="text-zinc-500">
              Nenhum empréstimo atual cadastrado. Clique em editar ficha para
              cadastrar.
            </p>
          )}
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <h3 className="text-xl font-bold mb-4">Documentos</h3>

          <div className="space-y-2 text-sm">
            {safeClient.anexos?.extrato?.url && (
              <a
                className="block text-purple-300 hover:underline"
                href={safeClient.anexos.extrato.url}
                target="_blank"
                rel="noreferrer"
              >
                Abrir extrato
              </a>
            )}

            {safeClient.anexos?.comprovanteResidencia?.url && (
              <a
                className="block text-purple-300 hover:underline"
                href={safeClient.anexos.comprovanteResidencia.url}
                target="_blank"
                rel="noreferrer"
              >
                Abrir comprovante de residência
              </a>
            )}

            {safeClient.anexos?.identidade?.url && (
              <a
                className="block text-purple-300 hover:underline"
                href={safeClient.anexos.identidade.url}
                target="_blank"
                rel="noreferrer"
              >
                Abrir identidade
              </a>
            )}

            {safeClient.anexos?.outros?.url && (
              <a
                className="block text-purple-300 hover:underline"
                href={safeClient.anexos.outros.url}
                target="_blank"
                rel="noreferrer"
              >
                Abrir outros
              </a>
            )}

            {!safeClient.anexos?.extrato?.url &&
              !safeClient.anexos?.comprovanteResidencia?.url &&
              !safeClient.anexos?.identidade?.url &&
              !safeClient.anexos?.outros?.url && (
                <p className="text-zinc-500">Nenhum documento anexado.</p>
              )}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
          <div>
            <p className="text-purple-300 text-sm font-medium">
              Empréstimo atual
            </p>
            <h3 className="text-2xl font-bold">Resumo dos pagamentos</h3>
          </div>

          <div className="text-sm text-zinc-500">
            {eventos.length} parcela(s)
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <InfoCard
            title="Pagas"
            value={pagos.length}
            subtitle="quitadas"
            tone="green"
          />

          <InfoCard
            title="Pendentes"
            value={pendentes.length}
            subtitle="aguardando"
          />

          <InfoCard
            title="Parciais"
            value={parciais.length}
            subtitle="pagas em parte"
            tone="blue"
          />

          <InfoCard
            title="Atrasadas"
            value={atrasados.length}
            subtitle="com atraso"
            tone="red"
          />

          <InfoCard
            title="Canceladas"
            value={cancelados.length}
            subtitle="sem cobrança"
          />
        </div>

        <div className="space-y-3">
          {eventos.map((event) => (
            <div
              key={event.id}
              className={`rounded-2xl border p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 ${getStatusStyle(
                event.statusPagamento
              )}`}
            >
              <div>
                <p className="font-semibold">{formatDateBR(event.date)}</p>

                <p className="text-sm text-zinc-500">
                  {event.tipo} · {event.statusPagamento}
                </p>

                {event.descricao && (
                  <p className="text-xs text-zinc-400 mt-1">
                    {event.descricao}
                  </p>
                )}

                {event.observacao && (
                  <p className="text-xs text-zinc-400 mt-1">
                    Obs: {event.observacao}
                  </p>
                )}
              </div>

              <div className="text-left md:text-right">
                {Number(event.valorPago || 0) > 0 && (
                  <p className="text-xs text-blue-200">
                    Pago parcial: {money.format(event.valorPago)}
                  </p>
                )}

                <p className="font-bold text-purple-200">
                  {money.format(event.valor)}
                </p>

                {event.statusPagamento === paymentStatuses.LATE && (
                  <p className="text-xs text-red-200">
                    Com multa: {money.format(event.valorComMulta)}
                  </p>
                )}
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

      <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
        <div className="mb-5">
          <p className="text-purple-300 text-sm font-medium">Histórico</p>
          <h3 className="text-2xl font-bold">
            Empréstimos anteriores deste cliente
          </h3>
          <p className="text-zinc-500 text-sm mt-1">
            Cada vez que você inicia um novo empréstimo, o anterior fica salvo
            aqui.
          </p>
        </div>

        <div className="space-y-3">
          {historicoEmprestimos.map((loan, index) => (
            <div
              key={`${loan?.finalizadoEm || "loan"}-${index}`}
              className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-4"
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <p className="font-bold">Empréstimo #{index + 1}</p>

                  <p className="text-sm text-zinc-500">
                    Finalizado em{" "}
                    {loan?.finalizadoEm
                      ? new Date(loan.finalizadoEm).toLocaleDateString("pt-BR")
                      : "-"}
                  </p>

                  <p className="text-sm text-zinc-500">
                    {loan?.frequencia || "-"} · início{" "}
                    {formatDateBR(loan?.dataInicio)}
                    {loan?.dataTermino
                      ? ` · fim ${formatDateBR(loan.dataTermino)}`
                      : ""}
                  </p>

                  {loan?.frequencia === paymentTypes.FIXED_DATES && (
                    <p className="text-xs text-zinc-500 mt-1">
                      Dias fixos:{" "}
                      {Array.isArray(loan.diasPagamentoFixos)
                        ? loan.diasPagamentoFixos.join(", ")
                        : "-"}
                    </p>
                  )}

                  {loan?.frequencia === paymentTypes.CUSTOM && (
                    <p className="text-xs text-zinc-500 mt-1">
                      Parcelas personalizadas:{" "}
                      {Array.isArray(loan.parcelasPersonalizadas)
                        ? loan.parcelasPersonalizadas.length
                        : 0}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-zinc-500">Enviado</p>
                    <p>{money.format(loan?.valorEnviado || 0)}</p>
                  </div>

                  <div>
                    <p className="text-zinc-500">Recebido</p>
                    <p className="text-purple-200">
                      {money.format(loan?.valorReceber || 0)}
                    </p>
                  </div>

                  <div>
                    <p className="text-zinc-500">Lucro</p>
                    <p className="text-emerald-200">
                      {money.format(loan?.lucro || 0)}
                    </p>
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

      {safeClient.observacao && (
        <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
          <h3 className="text-xl font-bold mb-3">Observações gerais</h3>
          <p className="text-zinc-400 whitespace-pre-wrap">
            {safeClient.observacao}
          </p>
        </div>
      )}
    </div>
  );
}
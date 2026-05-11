import { useMemo, useState } from "react";
import { StatusBadge } from "./ui";
import { money, formatDateBR } from "../utils/helpers";
import {
  calculateInstallment,
  calculateLateAmount,
  buildCalendarEvents,
  paymentTypes,
  paymentStatuses,
  getClientRisk,
  getClientMetrics,
} from "../utils/calculations";

function normalizeEvent(event) {
  const status = event.statusPagamento || paymentStatuses.PENDING;

  const isSettled =
    status === paymentStatuses.PAID || status === paymentStatuses.CANCELED;

  const displayValue = Number(
    event.saldo ??
      event.remainingAmount ??
      event.valorComMulta ??
      event.totalWithFine ??
      event.valor ??
      event.amount ??
      0
  );

  const originalValue = Number(
    event.valorOriginal ??
      event.originalAmount ??
      event.valor ??
      event.amount ??
      0
  );

  const paidValue = Number(event.valorPago ?? event.amountPaid ?? 0);

  return {
    ...event,
    name: event.nome || event.clientName || event.nomeCliente || "Cliente",
    status,
    isSettled,
    displayValue: isSettled ? 0 : Math.max(0, displayValue),
    originalValue,
    paidValue,
  };
}

function getStatusLabel(status) {
  if (status === paymentStatuses.PAID) return "Pago";
  if (status === paymentStatuses.LATE) return "Atrasado";
  if (status === paymentStatuses.PARTIAL) return "Parcial";
  if (status === paymentStatuses.CANCELED) return "Cancelado";
  return "Pendente";
}

function getStatusStyle(status) {
  if (status === paymentStatuses.PAID) {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }

  if (status === paymentStatuses.LATE) {
    return "border-rose-500/20 bg-rose-500/10 text-rose-300";
  }

  if (status === paymentStatuses.PARTIAL) {
    return "border-amber-500/20 bg-amber-500/10 text-amber-300";
  }

  if (status === paymentStatuses.CANCELED) {
    return "border-slate-500/20 bg-slate-500/10 text-slate-300";
  }

  return "border-orange-500/20 bg-orange-500/10 text-orange-300";
}

function InfoCard({ title, value, subtitle, tone = "orange" }) {
  const tones = {
    orange: "border-orange-500/20 bg-orange-500/10 text-orange-300",
    green: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    red: "border-rose-500/20 bg-rose-500/10 text-rose-300",
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    slate: "border-white/[0.08] bg-white/[0.03] text-white",
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] || tones.orange}`}>
      <p className="text-xs font-medium text-slate-500">{title}</p>
      <p className="mt-2 break-words text-xl font-bold">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
    </div>
  );
}

function SectionCard({ title, subtitle, children, action }) {
  return (
    <div className="card-dark rounded-2xl p-4">
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-base font-bold text-white">{title}</h3>
          {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
        </div>

        {action}
      </div>

      {children}
    </div>
  );
}

function DetailLine({ label, value }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <strong className="break-words text-sm font-semibold text-slate-200">
        {value || "-"}
      </strong>
    </div>
  );
}

function getPaymentDescription(client) {
  if (!client.abrirConta || Number(client.valorReceber || 0) <= 0) {
    return "Sem empréstimo atual";
  }

  if (client.frequencia === paymentTypes.DAILY || client.frequencia === "Diario") {
    return `Diário · ${formatDateBR(client.dataInicio)} até ${formatDateBR(
      client.dataTermino
    )}`;
  }

  if (client.frequencia === paymentTypes.WEEKLY) {
    return `Semanal · ${client.semanas || 0} semana(s)`;
  }

  if (
    client.frequencia === paymentTypes.FIXED_DATES ||
    String(client.frequencia || "").toLowerCase() === "datas fixas" ||
    String(client.frequencia || "").toLowerCase() === "datas fixas"
  ) {
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

    const validParcelas = parcelas
      .filter((item) => item && item.date)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));

    const last = validParcelas.at(-1);

    return last ? formatDateBR(last.date) : "-";
  }

  return formatDateBR(client.dataTermino);
}

function getWhatsappLink(client) {
  const onlyNumbers = String(client.whatsapp || "").replace(/\D/g, "");

  if (!onlyNumbers) return "";

  const phone = onlyNumbers.startsWith("55") ? onlyNumbers : `55${onlyNumbers}`;

  const message = encodeURIComponent(
    `Olá, ${client.nome}! Tudo bem? Estou entrando em contato sobre sua ficha.`
  );

  return `https://wa.me/${phone}?text=${message}`;
}

function DocumentCard({ label, file }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
      <p className="text-sm font-bold text-white">{label}</p>

      {file?.url ? (
        <a
          className="mt-3 inline-flex rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-orange-600"
          href={file.url}
          target="_blank"
          rel="noreferrer"
        >
          Abrir documento
        </a>
      ) : (
        <p className="mt-2 text-sm text-slate-500">Nenhum arquivo anexado.</p>
      )}
    </div>
  );
}

export default function ClientProfile({
  client,
  onBack,
  onEdit,
  onMarkRecordAsPaid,
  onNewLoan,
  onRemove,
}) {
  const [activeSection, setActiveSection] = useState("resumo");

  if (!client) {
    return (
      <div className="card-dark rounded-2xl p-5 text-white">
        <p className="text-slate-400">Cliente não encontrado.</p>

        <button
          onClick={onBack}
          className="mt-4 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white"
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
      client.anexos && typeof client.anexos === "object" ? client.anexos : {},
  };

  const eventos = useMemo(
    () => (buildCalendarEvents([safeClient]) || []).map(normalizeEvent),
    [safeClient]
  );

  const parcela = calculateInstallment(safeClient);
  const parcelaComMulta = calculateLateAmount(
    parcela,
    safeClient.multaPercentual
  );

  const pagos = eventos.filter(
    (event) => event.status === paymentStatuses.PAID
  );

  const pendentes = eventos.filter(
    (event) => event.status === paymentStatuses.PENDING
  );

  const atrasados = eventos.filter(
    (event) => event.status === paymentStatuses.LATE
  );

  const parciais = eventos.filter(
    (event) => event.status === paymentStatuses.PARTIAL
  );

  const cancelados = eventos.filter(
    (event) => event.status === paymentStatuses.CANCELED
  );

  const historicoEmprestimos = safeClient.historicoEmprestimos;

  const metrics = getClientMetrics(safeClient);
  const score = getClientRisk(safeClient);
  const whatsappLink = getWhatsappLink(safeClient);

  const tabs = [
    { id: "resumo", label: "Resumo" },
    { id: "dados", label: "Dados" },
    { id: "parcelas", label: "Parcelas" },
    { id: "documentos", label: "Documentos" },
    { id: "historico", label: "Histórico" },
  ];

  return (
    <div className="space-y-4">
      <div className="card-dark rounded-2xl p-4 md:p-5">
        <button
          onClick={onBack}
          className="mb-4 text-sm font-medium text-slate-500 transition hover:text-white"
        >
          ← Voltar para clientes
        </button>

        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-300">
                Ficha do cliente
              </p>

              <StatusBadge status={safeClient.status} />

              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${score.className}`}
              >
                {score.label}
              </span>
            </div>

            <h2 className="mt-2 break-words text-2xl font-bold text-white md:text-3xl">
              {safeClient.nome}
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              {safeClient.whatsapp || "Sem WhatsApp"} · CPF{" "}
              {safeClient.cpf || "-"}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-300">
                {getPaymentDescription(safeClient)}
              </span>

              <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-400">
                {metrics.totalLoans} empréstimo(s)
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {whatsappLink && (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700"
              >
                WhatsApp
              </a>
            )}

            <button
              onClick={() => onEdit(safeClient)}
              className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
            >
              Editar ficha
            </button>

            {safeClient.status !== "Quitado" && (
              <button
                onClick={() => onMarkRecordAsPaid(safeClient.id)}
                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700"
              >
                Marcar quitado
              </button>
            )}

            {safeClient.status === "Quitado" && (
              <button
                onClick={() => onNewLoan(safeClient.id)}
                className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-orange-600"
              >
                Novo empréstimo
              </button>
            )}

            <button
              onClick={() => onRemove(safeClient.id)}
              className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-rose-700"
            >
              Excluir
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <InfoCard
          title="Total emprestado"
          value={money.format(metrics.totalSent || metrics.totalEnviado || 0)}
          subtitle="Atual + histórico"
          tone="orange"
        />

        <InfoCard
          title="Total esperado"
          value={money.format(metrics.totalExpected || metrics.totalAReceber || 0)}
          subtitle="Atual + histórico"
          tone="green"
        />

        <InfoCard
          title="Lucro total"
          value={money.format(metrics.totalProfit || metrics.totalLucro || 0)}
          subtitle={`${metrics.totalLoans || 0} empréstimo(s)`}
          tone="amber"
        />

        <InfoCard
          title="Em aberto"
          value={money.format(metrics.totalOpenCurrent || metrics.abertoAtual || 0)}
          subtitle="Saldo atual"
          tone="red"
        />
      </div>

      <div className="card-dark rounded-2xl p-2">
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                activeSection === tab.id
                  ? "bg-orange-500 text-white"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeSection === "resumo" && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_0.8fr]">
          <SectionCard
            title="Resumo do empréstimo atual"
            subtitle="Informações principais da conta em andamento."
          >
            {safeClient.abrirConta && Number(safeClient.valorReceber || 0) > 0 ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <DetailLine label="Tipo" value={safeClient.frequencia} />

                <DetailLine
                  label="Valor enviado"
                  value={money.format(safeClient.valorEnviado || 0)}
                />

                <DetailLine
                  label="Valor a receber"
                  value={money.format(safeClient.valorReceber || 0)}
                />

                <DetailLine
                  label="Lucro previsto"
                  value={money.format(
                    Number(safeClient.valorReceber || 0) -
                      Number(safeClient.valorEnviado || 0)
                  )}
                />

                <DetailLine
                  label="Início"
                  value={formatDateBR(safeClient.dataInicio)}
                />

                <DetailLine label="Término" value={getLoanEndLabel(safeClient)} />

                {safeClient.frequencia === paymentTypes.FIXED_DATES && (
                  <DetailLine
                    label="Dias fixos"
                    value={safeClient.diasPagamentoFixos.join(", ") || "-"}
                  />
                )}

                {safeClient.frequencia === paymentTypes.WEEKLY && (
                  <DetailLine
                    label="Quantidade de semanas"
                    value={`${safeClient.semanas || 0} semana(s)`}
                  />
                )}

                {safeClient.frequencia !== paymentTypes.CUSTOM && (
                  <>
                    <DetailLine
                      label="Valor médio da parcela"
                      value={money.format(parcela)}
                    />

                    <DetailLine
                      label="Parcela com multa"
                      value={money.format(parcelaComMulta)}
                    />
                  </>
                )}

                {safeClient.frequencia === paymentTypes.CUSTOM && (
                  <DetailLine
                    label="Parcelas personalizadas"
                    value={`${safeClient.parcelasPersonalizadas.length} parcela(s)`}
                  />
                )}
              </div>
            ) : (
              <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-sm text-slate-500">
                Nenhum empréstimo atual cadastrado.
              </p>
            )}
          </SectionCard>

          <SectionCard title="Comportamento" subtitle="Leitura rápida do cliente.">
            <div className="space-y-3">
              <div className={`rounded-2xl border p-4 ${score.className}`}>
                <p className="text-xs text-slate-500">Score do cliente</p>
                <p className="mt-2 text-2xl font-bold text-white">
                  {score.label}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {score.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                  tone="orange"
                />

                <InfoCard
                  title="Parciais"
                  value={parciais.length}
                  subtitle="pagamento parcial"
                  tone="amber"
                />

                <InfoCard
                  title="Atrasadas"
                  value={atrasados.length}
                  subtitle={money.format(metrics.totalLateCurrent || 0)}
                  tone="red"
                />
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {activeSection === "dados" && (
        <SectionCard
          title="Dados pessoais"
          subtitle="Informações de contato e endereço do cliente."
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <DetailLine label="Nome" value={safeClient.nome} />
            <DetailLine label="WhatsApp" value={safeClient.whatsapp} />
            <DetailLine label="CPF" value={safeClient.cpf} />
            <DetailLine label="CEP" value={safeClient.cep} />
            <DetailLine label="Endereço" value={safeClient.endereco} />
            <DetailLine label="Número" value={safeClient.numero} />
            <DetailLine label="Complemento" value={safeClient.complemento} />
            <DetailLine label="Bairro" value={safeClient.bairro} />
            <DetailLine
              label="Cidade/UF"
              value={`${safeClient.cidade || "-"}/${safeClient.estado || "-"}`}
            />
          </div>

          {safeClient.observacao && (
            <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
              <p className="text-xs font-medium text-slate-500">
                Observações gerais
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">
                {safeClient.observacao}
              </p>
            </div>
          )}
        </SectionCard>
      )}

      {activeSection === "parcelas" && (
        <SectionCard
          title="Parcelas do empréstimo atual"
          subtitle="Todas as parcelas geradas para a conta atual."
          action={
            <span className="rounded-full bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-400">
              {eventos.length} parcela(s)
            </span>
          }
        >
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
            <InfoCard title="Pagas" value={pagos.length} tone="green" />
            <InfoCard title="Pendentes" value={pendentes.length} tone="orange" />
            <InfoCard title="Parciais" value={parciais.length} tone="amber" />
            <InfoCard title="Atrasadas" value={atrasados.length} tone="red" />
            <InfoCard title="Canceladas" value={cancelados.length} tone="slate" />
          </div>

          <div className="space-y-3">
            {eventos.map((event) => (
              <div
                key={event.id}
                className={`rounded-xl border p-4 ${getStatusStyle(
                  event.status
                )}`}
              >
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-white">
                        {formatDateBR(event.date)}
                      </p>

                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusStyle(
                          event.status
                        )}`}
                      >
                        {getStatusLabel(event.status)}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-slate-500">
                      {event.tipo || event.typeLabel || "Parcela"}
                      {event.descricao ? ` · ${event.descricao}` : ""}
                    </p>

                    {event.observacao && (
                      <p className="mt-1 text-xs text-slate-400">
                        Obs: {event.observacao}
                      </p>
                    )}
                  </div>

                  <div className="text-left md:text-right">
                    {Number(event.paidValue || 0) > 0 && (
                      <p className="text-xs text-amber-300">
                        Pago parcial: {money.format(event.paidValue)}
                      </p>
                    )}

                    <p className="text-base font-bold text-white">
                      {money.format(event.displayValue || event.originalValue)}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {eventos.length === 0 && (
              <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 text-center text-sm text-slate-500">
                Nenhum pagamento gerado para o empréstimo atual.
              </p>
            )}
          </div>
        </SectionCard>
      )}

      {activeSection === "documentos" && (
        <SectionCard
          title="Documentos"
          subtitle="Arquivos anexados na ficha do cliente."
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <DocumentCard label="Extrato" file={safeClient.anexos?.extrato} />
            <DocumentCard
              label="Comprovante de residência"
              file={safeClient.anexos?.comprovanteResidencia}
            />
            <DocumentCard
              label="Identidade"
              file={safeClient.anexos?.identidade}
            />
            <DocumentCard label="Outros" file={safeClient.anexos?.outros} />
          </div>
        </SectionCard>
      )}

      {activeSection === "historico" && (
        <SectionCard
          title="Histórico de empréstimos"
          subtitle="Empréstimos anteriores salvos deste cliente."
        >
          <div className="space-y-3">
            {historicoEmprestimos.map((loan, index) => (
              <div
                key={`${loan?.finalizadoEm || "loan"}-${index}`}
                className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4"
              >
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                  <div>
                    <p className="font-bold text-white">
                      Empréstimo #{index + 1}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Finalizado em{" "}
                      {loan?.finalizadoEm
                        ? new Date(loan.finalizadoEm).toLocaleDateString("pt-BR")
                        : "-"}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {loan?.frequencia || "-"} · início{" "}
                      {formatDateBR(loan?.dataInicio)}
                      {loan?.dataTermino
                        ? ` · fim ${formatDateBR(loan.dataTermino)}`
                        : ""}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
                    <DetailLine
                      label="Enviado"
                      value={money.format(loan?.valorEnviado || 0)}
                    />

                    <DetailLine
                      label="Recebido"
                      value={money.format(loan?.valorReceber || 0)}
                    />

                    <DetailLine
                      label="Lucro"
                      value={money.format(loan?.lucro || 0)}
                    />
                  </div>
                </div>
              </div>
            ))}

            {historicoEmprestimos.length === 0 && (
              <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 text-center text-sm text-slate-500">
                Nenhum empréstimo anterior salvo ainda.
              </p>
            )}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
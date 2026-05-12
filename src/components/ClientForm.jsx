import { useMemo, useState } from "react";
import { money, todayISO } from "../utils/helpers";
import {
  calculateReceivable,
  paymentTypes,
  toNumber,
} from "../utils/calculations";

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-300">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div className="card-dark rounded-2xl p-4 md:p-5">
      <div className="mb-5">
        <h3 className="text-base font-bold text-white">{title}</h3>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function inputClass() {
  return "input-dark w-full rounded-xl px-4 py-3 text-sm outline-none";
}

function ToggleButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-4 py-3 text-sm font-bold transition ${
        active
          ? "bg-orange-500 text-white"
          : "border border-white/[0.08] bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function SummaryCard({ label, value, tone = "orange" }) {
  const tones = {
    orange: "border-orange-500/20 bg-orange-500/10 text-orange-300",
    green: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    slate: "border-white/[0.08] bg-white/[0.03] text-white",
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] || tones.orange}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 break-words text-xl font-bold">{value}</p>
    </div>
  );
}

function FileInput({ label, value, onChange }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
      <p className="text-sm font-bold text-white">{label}</p>

      <input
        type="file"
        onChange={(e) => onChange(e.target.files?.[0] || null)}
        className="mt-3 block w-full text-sm text-slate-400 file:mr-4 file:rounded-xl file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-orange-600"
      />

      {value && (
        <p className="mt-2 truncate text-xs text-orange-300">
          Selecionado: {value.name}
        </p>
      )}
    </div>
  );
}

function normalizeFixedDays(days) {
  return (days || [])
    .map((day) => String(day))
    .filter((day) => day.trim() !== "");
}

export default function ClientForm({
  form,
  setForm,
  editingId,
  saving,
  onSubmit,
  onCancelEdit,
}) {
  const [customDate, setCustomDate] = useState("");
  const [customValue, setCustomValue] = useState("");
  const [customDescription, setCustomDescription] = useState("");

  const safeForm = {
    ...form,
    abrirConta: form.abrirConta !== false,
    diasPagamentoFixos: Array.isArray(form.diasPagamentoFixos)
      ? form.diasPagamentoFixos
      : ["15", "30"],
    parcelasPersonalizadas: Array.isArray(form.parcelasPersonalizadas)
      ? form.parcelasPersonalizadas
      : [],
    dataInicio: form.dataInicio || todayISO(),
  };

  const valorReceber = useMemo(() => {
    if (!safeForm.abrirConta) return 0;

    return calculateReceivable(
      safeForm.valorEnviado,
      safeForm.porcentagemRetorno
    );
  }, [safeForm.abrirConta, safeForm.valorEnviado, safeForm.porcentagemRetorno]);

  const lucro = useMemo(() => {
    return Math.max(0, valorReceber - toNumber(safeForm.valorEnviado));
  }, [valorReceber, safeForm.valorEnviado]);

  const customTotal = useMemo(() => {
    return safeForm.parcelasPersonalizadas.reduce(
      (sum, item) => sum + toNumber(item.value),
      0
    );
  }, [safeForm.parcelasPersonalizadas]);

  const fixedDays = normalizeFixedDays(safeForm.diasPagamentoFixos);

  function updateField(name, value) {
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function setFrequency(frequency) {
    setForm((prev) => ({
      ...prev,
      frequencia: frequency,
      diasPagamentoFixos:
        frequency === paymentTypes.FIXED_DATES
          ? normalizeFixedDays(prev.diasPagamentoFixos).length > 0
            ? normalizeFixedDays(prev.diasPagamentoFixos)
            : ["15", "30"]
          : prev.diasPagamentoFixos,
      dataInicio: prev.dataInicio || todayISO(),
    }));
  }

  function toggleFixedDay(day) {
    const dayString = String(day);
    const current = normalizeFixedDays(safeForm.diasPagamentoFixos);
    const exists = current.includes(dayString);

    const next = exists
      ? current.filter((item) => item !== dayString)
      : [...current, dayString];

    updateField(
      "diasPagamentoFixos",
      next.sort((a, b) => Number(a) - Number(b))
    );
  }

  function addCustomInstallment() {
    if (!customDate || !toNumber(customValue)) {
      alert("Preencha a data e o valor da parcela personalizada.");
      return;
    }

    const nextItem = {
      id: `${Date.now()}-${Math.random()}`,
      date: customDate,
      value: String(customValue),
      descricao: customDescription,
    };

    setForm((prev) => ({
      ...prev,
      parcelasPersonalizadas: [
        ...(Array.isArray(prev.parcelasPersonalizadas)
          ? prev.parcelasPersonalizadas
          : []),
        nextItem,
      ].sort((a, b) => String(a.date).localeCompare(String(b.date))),
    }));

    setCustomDate("");
    setCustomValue("");
    setCustomDescription("");
  }

  function removeCustomInstallment(id) {
    setForm((prev) => ({
      ...prev,
      parcelasPersonalizadas: (
        Array.isArray(prev.parcelasPersonalizadas)
          ? prev.parcelasPersonalizadas
          : []
      ).filter((item) => item.id !== id),
    }));
  }

  function updateCustomInstallment(id, field, value) {
    setForm((prev) => ({
      ...prev,
      parcelasPersonalizadas: (
        Array.isArray(prev.parcelasPersonalizadas)
          ? prev.parcelasPersonalizadas
          : []
      ).map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: value,
            }
          : item
      ),
    }));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="card-dark rounded-2xl p-4 md:p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-300">
              {editingId ? "Editar ficha" : "Novo cliente"}
            </p>

            <h2 className="mt-2 text-2xl font-bold text-white">
              {editingId ? "Atualizar cadastro" : "Cadastrar novo cliente"}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Preencha os dados do cliente, configure o empréstimo e anexe documentos.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {editingId && (
              <button
                type="button"
                onClick={onCancelEdit}
                className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
              >
                Cancelar edição
              </button>
            )}

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-orange-600 disabled:opacity-60"
            >
              {saving
                ? "Salvando..."
                : editingId
                ? "Salvar alterações"
                : "Cadastrar cliente"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <SummaryCard
          label="Valor enviado"
          value={money.format(toNumber(safeForm.valorEnviado))}
          tone="orange"
        />

        <SummaryCard
          label="Valor a receber"
          value={money.format(valorReceber)}
          tone="green"
        />

        <SummaryCard
          label="Lucro previsto"
          value={money.format(lucro)}
          tone="amber"
        />

        <SummaryCard
          label="Parcelas personalizadas"
          value={safeForm.parcelasPersonalizadas.length}
          tone="slate"
        />
      </div>

      <Section
        title="Dados do cliente"
        subtitle="Informações principais para identificar e entrar em contato."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Nome completo">
            <input
              value={safeForm.nome}
              onChange={(e) => updateField("nome", e.target.value)}
              className={inputClass()}
              placeholder="Ex: Maria Silva"
            />
          </Field>

          <Field label="WhatsApp">
            <input
              value={safeForm.whatsapp}
              onChange={(e) => updateField("whatsapp", e.target.value)}
              className={inputClass()}
              placeholder="Ex: (35) 99999-9999"
            />
          </Field>

          <Field label="CPF">
            <input
              value={safeForm.cpf}
              onChange={(e) => updateField("cpf", e.target.value)}
              className={inputClass()}
              placeholder="000.000.000-00"
            />
          </Field>
        </div>
      </Section>

      <Section
        title="Endereço"
        subtitle="Dados úteis para cadastro e conferência do cliente."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Field label="CEP">
            <input
              value={safeForm.cep}
              onChange={(e) => updateField("cep", e.target.value)}
              className={inputClass()}
              placeholder="00000-000"
            />
          </Field>

          <Field label="Endereço">
            <input
              value={safeForm.endereco}
              onChange={(e) => updateField("endereco", e.target.value)}
              className={inputClass()}
              placeholder="Rua, avenida..."
            />
          </Field>

          <Field label="Número">
            <input
              value={safeForm.numero}
              onChange={(e) => updateField("numero", e.target.value)}
              className={inputClass()}
              placeholder="Nº"
            />
          </Field>

          <Field label="Complemento">
            <input
              value={safeForm.complemento}
              onChange={(e) => updateField("complemento", e.target.value)}
              className={inputClass()}
              placeholder="Casa, apto..."
            />
          </Field>

          <Field label="Bairro">
            <input
              value={safeForm.bairro}
              onChange={(e) => updateField("bairro", e.target.value)}
              className={inputClass()}
              placeholder="Bairro"
            />
          </Field>

          <Field label="Cidade">
            <input
              value={safeForm.cidade}
              onChange={(e) => updateField("cidade", e.target.value)}
              className={inputClass()}
              placeholder="Cidade"
            />
          </Field>

          <Field label="Estado">
            <input
              value={safeForm.estado}
              onChange={(e) => updateField("estado", e.target.value)}
              className={inputClass()}
              placeholder="UF"
            />
          </Field>
        </div>
      </Section>

      <Section
        title="Conta e valores"
        subtitle="Configure se este cliente terá uma conta/empréstimo aberto."
      >
        <div className="mb-5 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={safeForm.abrirConta}
              onChange={(e) => updateField("abrirConta", e.target.checked)}
              className="h-5 w-5 accent-orange-500"
            />

            <div>
              <p className="text-sm font-bold text-white">Abrir conta/empréstimo</p>
              <p className="text-xs text-slate-500">
                Desmarque caso queira cadastrar apenas os dados do cliente.
              </p>
            </div>
          </label>
        </div>

        {safeForm.abrirConta && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Field label="Valor enviado/pedido">
              <input
                type="text"
                inputMode="decimal"
                value={safeForm.valorEnviado}
                onChange={(e) => updateField("valorEnviado", e.target.value)}
                className={inputClass()}
                placeholder="Ex: 500 ou 500,50"
              />
            </Field>

            <Field label="% de retorno" hint="Agora aceita vírgula. Ex: 85,4">
              <input
                type="text"
                inputMode="decimal"
                value={safeForm.porcentagemRetorno}
                onChange={(e) =>
                  updateField("porcentagemRetorno", e.target.value)
                }
                className={inputClass()}
                placeholder="Ex: 85,4"
              />
            </Field>

            <Field label="Multa por atraso (% ao dia)" hint="Ex: 7 ou 7,5">
              <input
                type="text"
                inputMode="decimal"
                value={safeForm.multaPercentual}
                onChange={(e) => updateField("multaPercentual", e.target.value)}
                className={inputClass()}
                placeholder="Ex: 7"
              />
            </Field>

            <Field label="Status">
              <select
                value={safeForm.status}
                onChange={(e) => updateField("status", e.target.value)}
                className={inputClass()}
              >
                <option value="Ativo">Ativo</option>
                <option value="Quitado">Quitado</option>
                <option value="Atrasado">Atrasado</option>
                <option value="Recebido">Recebido</option>
                <option value="Bloqueado">Bloqueado</option>
              </select>
            </Field>
          </div>
        )}
      </Section>

      {safeForm.abrirConta && (
        <Section
          title="Plano de pagamento"
          subtitle="Escolha como o cliente vai pagar. Para pagar dia 15 e 30, use Datas Fixas."
        >
          <div className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-4">
            <ToggleButton
              active={safeForm.frequencia === paymentTypes.DAILY}
              onClick={() => setFrequency(paymentTypes.DAILY)}
            >
              Diário
            </ToggleButton>

            <ToggleButton
              active={safeForm.frequencia === paymentTypes.WEEKLY}
              onClick={() => setFrequency(paymentTypes.WEEKLY)}
            >
              Semanal
            </ToggleButton>

            <ToggleButton
              active={safeForm.frequencia === paymentTypes.FIXED_DATES}
              onClick={() => setFrequency(paymentTypes.FIXED_DATES)}
            >
              Datas Fixas
            </ToggleButton>

            <ToggleButton
              active={safeForm.frequencia === paymentTypes.CUSTOM}
              onClick={() => setFrequency(paymentTypes.CUSTOM)}
            >
              Personalizado
            </ToggleButton>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Data de início">
              <input
                type="date"
                value={safeForm.dataInicio}
                onChange={(e) => updateField("dataInicio", e.target.value)}
                className={inputClass()}
              />
            </Field>

            {(safeForm.frequencia === paymentTypes.DAILY ||
              safeForm.frequencia === paymentTypes.FIXED_DATES) && (
              <Field label="Data de término">
                <input
                  type="date"
                  value={safeForm.dataTermino}
                  onChange={(e) => updateField("dataTermino", e.target.value)}
                  className={inputClass()}
                />
              </Field>
            )}

            {safeForm.frequencia === paymentTypes.WEEKLY && (
              <>
                <Field label="Quantidade de semanas">
                  <input
                    type="number"
                    min="1"
                    value={safeForm.semanas}
                    onChange={(e) => updateField("semanas", e.target.value)}
                    className={inputClass()}
                  />
                </Field>

                <Field label="Dia da semana">
                  <select
                    value={safeForm.diaPagamento}
                    onChange={(e) => updateField("diaPagamento", e.target.value)}
                    className={inputClass()}
                  >
                    <option value="1">Segunda-feira</option>
                    <option value="2">Terça-feira</option>
                    <option value="3">Quarta-feira</option>
                    <option value="4">Quinta-feira</option>
                    <option value="5">Sexta-feira</option>
                    <option value="6">Sábado</option>
                    <option value="0">Domingo</option>
                  </select>
                </Field>
              </>
            )}
          </div>

          {safeForm.frequencia === paymentTypes.FIXED_DATES && (
            <div className="mt-5 rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4">
              <div className="mb-4">
                <h4 className="text-sm font-bold text-white">
                  Dias fixos de pagamento
                </h4>
                <p className="mt-1 text-xs text-slate-500">
                  Use isso para casos como pagar uma parcela dia 15 e outra dia 30.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {[5, 10, 15, 20, 25, 30].map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleFixedDay(day)}
                    className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                      fixedDays.includes(String(day))
                        ? "bg-orange-500 text-white"
                        : "border border-white/[0.08] bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
                    }`}
                  >
                    Dia {day}
                  </button>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
                <input
                  value={fixedDays.join(", ")}
                  onChange={(e) =>
                    updateField(
                      "diasPagamentoFixos",
                      e.target.value
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean)
                    )
                  }
                  className={inputClass()}
                  placeholder="Ex: 15, 30"
                />

                <button
                  type="button"
                  onClick={() => updateField("diasPagamentoFixos", ["15", "30"])}
                  className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-orange-600"
                >
                  Usar 15 e 30
                </button>
              </div>
            </div>
          )}

          {safeForm.frequencia === paymentTypes.CUSTOM && (
            <div className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
              <div className="mb-4">
                <h4 className="text-sm font-bold text-white">
                  Parcelas personalizadas
                </h4>
                <p className="mt-1 text-xs text-slate-500">
                  Crie parcelas com datas e valores específicos.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className={inputClass()}
                />

                <input
                  type="text"
                  inputMode="decimal"
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  className={inputClass()}
                  placeholder="Valor"
                />

                <input
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  className={inputClass()}
                  placeholder="Descrição"
                />

                <button
                  type="button"
                  onClick={addCustomInstallment}
                  className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-orange-600"
                >
                  Adicionar
                </button>
              </div>

              <div className="mt-4 space-y-2">
                {safeForm.parcelasPersonalizadas.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-1 gap-2 rounded-xl border border-white/[0.08] bg-[#0d1016] p-3 md:grid-cols-[1fr_1fr_1fr_auto]"
                  >
                    <input
                      type="date"
                      value={item.date}
                      onChange={(e) =>
                        updateCustomInstallment(item.id, "date", e.target.value)
                      }
                      className={inputClass()}
                    />

                    <input
                      type="text"
                      inputMode="decimal"
                      value={item.value}
                      onChange={(e) =>
                        updateCustomInstallment(item.id, "value", e.target.value)
                      }
                      className={inputClass()}
                    />

                    <input
                      value={item.descricao || ""}
                      onChange={(e) =>
                        updateCustomInstallment(
                          item.id,
                          "descricao",
                          e.target.value
                        )
                      }
                      className={inputClass()}
                      placeholder="Descrição"
                    />

                    <button
                      type="button"
                      onClick={() => removeCustomInstallment(item.id)}
                      className="rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-rose-700"
                    >
                      Remover
                    </button>
                  </div>
                ))}

                {safeForm.parcelasPersonalizadas.length === 0 && (
                  <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-sm text-slate-500">
                    Nenhuma parcela personalizada adicionada.
                  </p>
                )}
              </div>

              <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
                <p className="text-sm text-amber-300">
                  Total das parcelas personalizadas:{" "}
                  <strong>{money.format(customTotal)}</strong>
                </p>

                {customTotal > 0 && valorReceber > 0 && (
                  <p className="mt-1 text-xs text-slate-400">
                    Diferença em relação ao valor a receber:{" "}
                    {money.format(valorReceber - customTotal)}
                  </p>
                )}
              </div>
            </div>
          )}
        </Section>
      )}

      <Section
        title="Observações"
        subtitle="Anote detalhes importantes sobre o cliente ou negociação."
      >
        <textarea
          value={safeForm.observacao}
          onChange={(e) => updateField("observacao", e.target.value)}
          className="input-dark min-h-[120px] w-full rounded-xl px-4 py-3 text-sm outline-none"
          placeholder="Ex: cliente indicado por..., prefere pagar via Pix..., combinar horário..."
        />
      </Section>

      <Section
        title="Documentos"
        subtitle="Anexe arquivos importantes para análise e conferência."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FileInput
            label="Extrato"
            value={safeForm.extrato}
            onChange={(file) => updateField("extrato", file)}
          />

          <FileInput
            label="Comprovante de residência"
            value={safeForm.comprovanteResidencia}
            onChange={(file) => updateField("comprovanteResidencia", file)}
          />

          <FileInput
            label="Identidade"
            value={safeForm.identidade}
            onChange={(file) => updateField("identidade", file)}
          />

          <FileInput
            label="Outros"
            value={safeForm.outros}
            onChange={(file) => updateField("outros", file)}
          />
        </div>
      </Section>

      <div className="sticky bottom-3 z-20 rounded-2xl border border-white/[0.08] bg-[#11151b]/95 p-3 shadow-2xl backdrop-blur">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-bold text-white">
              {editingId ? "Editar ficha" : "Cadastrar cliente"}
            </p>
            <p className="text-xs text-slate-500">
              Valor a receber: {money.format(valorReceber)} · Lucro:{" "}
              {money.format(lucro)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {editingId && (
              <button
                type="button"
                onClick={onCancelEdit}
                className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm font-bold text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
              >
                Cancelar
              </button>
            )}

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-orange-600 disabled:opacity-60"
            >
              {saving
                ? "Salvando..."
                : editingId
                ? "Salvar alterações"
                : "Cadastrar cliente"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
import { useMemo } from "react";
import { Field, Section, inputClass } from "./ui";
import { money, weekDays } from "../utils/helpers";
import {
  paymentTypes,
  calculateReceivable,
  calculateInstallment,
  calculateLateAmount,
  toNumber,
} from "../utils/calculations";

export default function ClientForm({
  form,
  setForm,
  editingId,
  saving,
  onSubmit,
  onCancelEdit,
}) {
  const valorReceberPreview = useMemo(
    () => calculateReceivable(form.valorEnviado, form.porcentagemRetorno),
    [form.valorEnviado, form.porcentagemRetorno]
  );

  const previewRecord = useMemo(
    () => ({
      ...form,
      valorReceber: valorReceberPreview,
      diasPagamentoFixos: form.diasPagamentoFixos || [],
      parcelasPersonalizadas: form.parcelasPersonalizadas || [],
    }),
    [form, valorReceberPreview]
  );

  const parcelaPreview = useMemo(
    () => calculateInstallment(previewRecord),
    [previewRecord]
  );

  const totalPersonalizado = useMemo(() => {
    return (form.parcelasPersonalizadas || []).reduce(
      (sum, item) => sum + toNumber(item.value),
      0
    );
  }, [form.parcelasPersonalizadas]);

  function handleChange(e) {
    const { name, value, files, type, checked } = e.target;

    if (files) {
      setForm((prev) => ({
        ...prev,
        [name]: files[0] || null,
      }));
      return;
    }

    if (type === "checkbox") {
      setForm((prev) => ({
        ...prev,
        [name]: checked,
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function updateFixedDay(index, value) {
    setForm((prev) => {
      const nextDays = [...(prev.diasPagamentoFixos || [])];
      nextDays[index] = value;

      return {
        ...prev,
        diasPagamentoFixos: nextDays,
      };
    });
  }

  function addFixedDay() {
    setForm((prev) => ({
      ...prev,
      diasPagamentoFixos: [...(prev.diasPagamentoFixos || []), ""],
    }));
  }

  function removeFixedDay(index) {
    setForm((prev) => ({
      ...prev,
      diasPagamentoFixos: (prev.diasPagamentoFixos || []).filter(
        (_, itemIndex) => itemIndex !== index
      ),
    }));
  }

  function addCustomInstallment() {
    setForm((prev) => ({
      ...prev,
      parcelasPersonalizadas: [
        ...(prev.parcelasPersonalizadas || []),
        {
          id: crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`,
          date: "",
          value: "",
          descricao: "",
        },
      ],
    }));
  }

  function updateCustomInstallment(index, field, value) {
    setForm((prev) => {
      const nextInstallments = [...(prev.parcelasPersonalizadas || [])];

      nextInstallments[index] = {
        ...nextInstallments[index],
        [field]: value,
      };

      return {
        ...prev,
        parcelasPersonalizadas: nextInstallments,
      };
    });
  }

  function removeCustomInstallment(index) {
    setForm((prev) => ({
      ...prev,
      parcelasPersonalizadas: (prev.parcelasPersonalizadas || []).filter(
        (_, itemIndex) => itemIndex !== index
      ),
    }));
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl shadow-sm border border-zinc-800 bg-zinc-950 p-4 md:p-5 space-y-6"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">
            {editingId ? "Editar cliente" : "Novo cliente"}
          </h2>

          <p className="text-zinc-400 text-sm mt-1">
            Dados pessoais, documentos e conta ficam fáceis de editar depois.
          </p>
        </div>

        {editingId && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="rounded-xl border border-zinc-800 px-4 py-3 text-zinc-300 hover:text-white"
          >
            Cancelar edição
          </button>
        )}
      </div>

      <Section
        title="Dados do cliente"
        description="Informações principais e endereço completo."
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Nome completo">
            <input
              name="nome"
              value={form.nome}
              onChange={handleChange}
              className={inputClass()}
            />
          </Field>

          <Field label="WhatsApp">
            <input
              name="whatsapp"
              value={form.whatsapp}
              onChange={handleChange}
              className={inputClass()}
            />
          </Field>

          <Field label="CPF">
            <input
              name="cpf"
              value={form.cpf}
              onChange={handleChange}
              className={inputClass()}
            />
          </Field>

          <Field label="CEP">
            <input
              name="cep"
              value={form.cep}
              onChange={handleChange}
              className={inputClass()}
            />
          </Field>

          <Field label="Endereço">
            <input
              name="endereco"
              value={form.endereco}
              onChange={handleChange}
              className={inputClass()}
            />
          </Field>

          <Field label="Número">
            <input
              name="numero"
              value={form.numero}
              onChange={handleChange}
              className={inputClass()}
            />
          </Field>

          <Field label="Complemento">
            <input
              name="complemento"
              value={form.complemento}
              onChange={handleChange}
              className={inputClass()}
            />
          </Field>

          <Field label="Bairro">
            <input
              name="bairro"
              value={form.bairro}
              onChange={handleChange}
              className={inputClass()}
            />
          </Field>

          <Field label="Cidade">
            <input
              name="cidade"
              value={form.cidade}
              onChange={handleChange}
              className={inputClass()}
            />
          </Field>

          <Field label="Estado">
            <input
              name="estado"
              value={form.estado}
              onChange={handleChange}
              className={inputClass()}
            />
          </Field>
        </div>
      </Section>

      <Section
        title="Conta do cliente"
        description="Abra uma conta e escolha o melhor tipo de pagamento."
      >
        <label className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 cursor-pointer">
          <input
            type="checkbox"
            name="abrirConta"
            checked={form.abrirConta}
            onChange={handleChange}
            className="w-5 h-5"
          />

          <div>
            <p className="font-semibold">Abrir conta para este cliente</p>
            <p className="text-sm text-zinc-500">
              Ative para adicionar valor pedido/enviado, retorno e calendário.
            </p>
          </div>
        </label>

        {form.abrirConta && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Field label="Quanto ele pediu / valor enviado">
                <input
                  name="valorEnviado"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.valorEnviado}
                  onChange={handleChange}
                  className={inputClass()}
                />
              </Field>

              <Field label="% que precisa voltar">
                <input
                  name="porcentagemRetorno"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.porcentagemRetorno}
                  onChange={handleChange}
                  className={inputClass()}
                />
              </Field>

              <Field label="Valor total a receber">
                <input
                  readOnly
                  value={money.format(valorReceberPreview)}
                  className={`${inputClass()} text-purple-200 font-bold`}
                />
              </Field>

              <Field label="Status">
                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  className={inputClass()}
                >
                  <option>Ativo</option>
                  <option>Recebido</option>
                  <option>Atrasado</option>
                  <option>Quitado</option>
                </select>
              </Field>

              <Field label="Tipo de pagamento">
                <select
                  name="frequencia"
                  value={form.frequencia}
                  onChange={handleChange}
                  className={inputClass()}
                >
                  <option>{paymentTypes.DAILY}</option>
                  <option>{paymentTypes.WEEKLY}</option>
                  <option>{paymentTypes.FIXED_DATES}</option>
                  <option>{paymentTypes.CUSTOM}</option>
                </select>
              </Field>

              <Field label="Data de início">
                <input
                  name="dataInicio"
                  type="date"
                  value={form.dataInicio}
                  onChange={handleChange}
                  className={inputClass()}
                />
              </Field>

              {(form.frequencia === paymentTypes.DAILY ||
                form.frequencia === paymentTypes.FIXED_DATES) && (
                <Field label="Data de término">
                  <input
                    name="dataTermino"
                    type="date"
                    value={form.dataTermino}
                    onChange={handleChange}
                    className={inputClass()}
                  />
                </Field>
              )}

              {form.frequencia === paymentTypes.WEEKLY && (
                <Field label="Número de semanas">
                  <input
                    name="semanas"
                    type="number"
                    min="1"
                    value={form.semanas}
                    onChange={handleChange}
                    className={inputClass()}
                  />
                </Field>
              )}

              {form.frequencia === paymentTypes.WEEKLY && (
                <Field label="Dia do pagamento">
                  <select
                    name="diaPagamento"
                    value={form.diaPagamento}
                    onChange={handleChange}
                    className={inputClass()}
                  >
                    {weekDays.map((day) => (
                      <option key={day.value} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              <Field label="Multa em atraso (%)">
                <input
                  name="multaPercentual"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.multaPercentual}
                  onChange={handleChange}
                  className={inputClass()}
                />
              </Field>

              {form.frequencia !== paymentTypes.CUSTOM && (
                <Field
                  label={
                    form.frequencia === paymentTypes.DAILY
                      ? "Valor por dia"
                      : form.frequencia === paymentTypes.WEEKLY
                      ? "Valor por semana"
                      : "Valor por data"
                  }
                >
                  <input
                    readOnly
                    value={money.format(parcelaPreview)}
                    className={`${inputClass()} text-emerald-200 font-bold`}
                  />
                </Field>
              )}

              {form.frequencia !== paymentTypes.CUSTOM && (
                <Field label="Parcela com multa">
                  <input
                    readOnly
                    value={money.format(
                      calculateLateAmount(
                        parcelaPreview,
                        form.multaPercentual
                      )
                    )}
                    className={`${inputClass()} text-red-200 font-bold`}
                  />
                </Field>
              )}
            </div>

            {form.frequencia === paymentTypes.DAILY && (
              <div className="rounded-2xl border border-purple-500/20 bg-purple-600/10 p-4 text-sm text-purple-100">
                A diária será calculada da data de início até a data de término,
                sem contar domingos.
              </div>
            )}

            {form.frequencia === paymentTypes.WEEKLY && (
              <div className="rounded-2xl border border-purple-500/20 bg-purple-600/10 p-4 text-sm text-purple-100">
                O pagamento semanal será dividido pelo número de semanas no dia
                escolhido.
              </div>
            )}

            {form.frequencia === paymentTypes.FIXED_DATES && (
              <div className="rounded-2xl border border-purple-500/20 bg-purple-600/10 p-4 space-y-4">
                <div>
                  <h4 className="font-bold text-purple-100">
                    Dias fixos do mês
                  </h4>
                  <p className="text-sm text-purple-100/70 mt-1">
                    Exemplo: dia 15 e dia 30. O sistema gera parcelas nessas
                    datas entre início e término.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {(form.diasPagamentoFixos || []).map((day, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={day}
                        onChange={(e) =>
                          updateFixedDay(index, e.target.value)
                        }
                        placeholder="Dia"
                        className={inputClass()}
                      />

                      <button
                        type="button"
                        onClick={() => removeFixedDay(index)}
                        className="rounded-xl bg-red-600 hover:bg-red-700 px-3 font-semibold"
                      >
                        X
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addFixedDay}
                  className="rounded-xl border border-purple-500/40 px-4 py-3 text-sm font-semibold text-purple-100 hover:bg-purple-600/20"
                >
                  + Adicionar dia fixo
                </button>
              </div>
            )}

            {form.frequencia === paymentTypes.CUSTOM && (
              <div className="rounded-2xl border border-purple-500/20 bg-purple-600/10 p-4 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-purple-100">
                      Parcelas personalizadas
                    </h4>
                    <p className="text-sm text-purple-100/70 mt-1">
                      Use quando cada parcela tiver uma data ou valor diferente.
                    </p>
                  </div>

                  <div className="rounded-xl bg-black/30 border border-purple-500/20 px-4 py-2 text-sm">
                    Total personalizado:{" "}
                    <strong className="text-purple-100">
                      {money.format(totalPersonalizado)}
                    </strong>
                  </div>
                </div>

                <div className="space-y-3">
                  {(form.parcelasPersonalizadas || []).map((item, index) => (
                    <div
                      key={item.id || index}
                      className="rounded-2xl border border-zinc-800 bg-black/30 p-3 grid grid-cols-1 md:grid-cols-12 gap-3"
                    >
                      <div className="md:col-span-3">
                        <input
                          type="date"
                          value={item.date || ""}
                          onChange={(e) =>
                            updateCustomInstallment(
                              index,
                              "date",
                              e.target.value
                            )
                          }
                          className={inputClass()}
                        />
                      </div>

                      <div className="md:col-span-3">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.value || ""}
                          onChange={(e) =>
                            updateCustomInstallment(
                              index,
                              "value",
                              e.target.value
                            )
                          }
                          placeholder="Valor da parcela"
                          className={inputClass()}
                        />
                      </div>

                      <div className="md:col-span-5">
                        <input
                          value={item.descricao || ""}
                          onChange={(e) =>
                            updateCustomInstallment(
                              index,
                              "descricao",
                              e.target.value
                            )
                          }
                          placeholder="Observação da parcela"
                          className={inputClass()}
                        />
                      </div>

                      <div className="md:col-span-1">
                        <button
                          type="button"
                          onClick={() => removeCustomInstallment(index)}
                          className="w-full h-full rounded-xl bg-red-600 hover:bg-red-700 px-3 py-3 font-semibold"
                        >
                          X
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addCustomInstallment}
                  className="rounded-xl border border-purple-500/40 px-4 py-3 text-sm font-semibold text-purple-100 hover:bg-purple-600/20"
                >
                  + Adicionar parcela personalizada
                </button>

                {totalPersonalizado > 0 &&
                  Math.abs(totalPersonalizado - valorReceberPreview) > 0.01 && (
                    <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-100">
                      Atenção: o total das parcelas personalizadas é{" "}
                      {money.format(totalPersonalizado)}, diferente do valor a
                      receber calculado de {money.format(valorReceberPreview)}.
                    </div>
                  )}
              </div>
            )}
          </div>
        )}
      </Section>

      <Section
        title="Documentos"
        description="Anexe fotos ou PDFs. A opção Outros serve para documentos extras."
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Field label="Extrato">
            <input
              name="extrato"
              type="file"
              accept="image/*,.pdf"
              onChange={handleChange}
              className={inputClass()}
            />
          </Field>

          <Field label="Comprovante de residência">
            <input
              name="comprovanteResidencia"
              type="file"
              accept="image/*,.pdf"
              onChange={handleChange}
              className={inputClass()}
            />
          </Field>

          <Field label="Identidade">
            <input
              name="identidade"
              type="file"
              accept="image/*,.pdf"
              onChange={handleChange}
              className={inputClass()}
            />
          </Field>

          <Field label="Outros">
            <input
              name="outros"
              type="file"
              accept="image/*,.pdf"
              onChange={handleChange}
              className={inputClass()}
            />
          </Field>
        </div>
      </Section>

      <Field label="Observações">
        <textarea
          name="observacao"
          value={form.observacao}
          onChange={handleChange}
          className={`${inputClass()} min-h-[100px]`}
        />
      </Field>

      <button
        type="submit"
        disabled={saving}
        className="w-full md:w-auto rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-8 py-4 font-semibold transition"
      >
        {saving
          ? "Salvando..."
          : editingId
          ? "Salvar alterações"
          : "Cadastrar cliente"}
      </button>
    </form>
  );
}
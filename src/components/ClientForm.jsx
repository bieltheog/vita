import { useMemo } from "react";
import { Field, Section, inputClass } from "./ui";
import { money, weekDays } from "../utils/helpers";
import {
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
    }),
    [form, valorReceberPreview]
  );

  const parcelaPreview = useMemo(
    () => calculateInstallment(previewRecord),
    [previewRecord]
  );

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

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl shadow-sm border border-zinc-800 bg-zinc-950 p-5 space-y-6"
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

      <Section title="Dados do cliente" description="Informações principais e endereço completo.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Nome completo">
            <input name="nome" value={form.nome} onChange={handleChange} className={inputClass()} />
          </Field>

          <Field label="WhatsApp">
            <input name="whatsapp" value={form.whatsapp} onChange={handleChange} className={inputClass()} />
          </Field>

          <Field label="CPF">
            <input name="cpf" value={form.cpf} onChange={handleChange} className={inputClass()} />
          </Field>

          <Field label="CEP">
            <input name="cep" value={form.cep} onChange={handleChange} className={inputClass()} />
          </Field>

          <Field label="Endereço">
            <input name="endereco" value={form.endereco} onChange={handleChange} className={inputClass()} />
          </Field>

          <Field label="Número">
            <input name="numero" value={form.numero} onChange={handleChange} className={inputClass()} />
          </Field>

          <Field label="Complemento">
            <input name="complemento" value={form.complemento} onChange={handleChange} className={inputClass()} />
          </Field>

          <Field label="Bairro">
            <input name="bairro" value={form.bairro} onChange={handleChange} className={inputClass()} />
          </Field>

          <Field label="Cidade">
            <input name="cidade" value={form.cidade} onChange={handleChange} className={inputClass()} />
          </Field>

          <Field label="Estado">
            <input name="estado" value={form.estado} onChange={handleChange} className={inputClass()} />
          </Field>
        </div>
      </Section>

      <Section title="Conta do cliente" description="Marque para abrir conta e configurar pagamento diário ou semanal.">
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
              <select name="status" value={form.status} onChange={handleChange} className={inputClass()}>
                <option>Ativo</option>
                <option>Recebido</option>
                <option>Atrasado</option>
              </select>
            </Field>

            <Field label="Pagamento">
              <select name="frequencia" value={form.frequencia} onChange={handleChange} className={inputClass()}>
                <option>Diário</option>
                <option>Semanal</option>
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

            {form.frequencia === "Diário" && (
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

            {form.frequencia === "Semanal" && (
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

            {form.frequencia === "Semanal" && (
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

            <Field label={form.frequencia === "Diário" ? "Valor por dia" : "Valor por semana"}>
              <input
                readOnly
                value={money.format(parcelaPreview)}
                className={`${inputClass()} text-emerald-200 font-bold`}
              />
            </Field>

            <Field label="Parcela com multa">
              <input
                readOnly
                value={money.format(calculateLateAmount(parcelaPreview, form.multaPercentual))}
                className={`${inputClass()} text-red-200 font-bold`}
              />
            </Field>

            {form.frequencia === "Diário" && form.dataTermino && (
              <div className="md:col-span-4 rounded-2xl border border-purple-500/20 bg-purple-600/10 p-4 text-sm text-purple-100">
                A diária será calculada da data de início até a data de término, sem contar domingos.
              </div>
            )}

            {form.frequencia === "Semanal" && toNumber(form.semanas) > 0 && (
              <div className="md:col-span-4 rounded-2xl border border-purple-500/20 bg-purple-600/10 p-4 text-sm text-purple-100">
                O pagamento semanal será dividido em {form.semanas} semana(s), no dia escolhido.
              </div>
            )}
          </div>
        )}
      </Section>

      <Section title="Documentos" description="Anexe fotos ou PDFs. A opção Outros serve para documentos extras.">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Field label="Extrato">
            <input name="extrato" type="file" accept="image/*,.pdf" onChange={handleChange} className={inputClass()} />
          </Field>

          <Field label="Comprovante de residência">
            <input name="comprovanteResidencia" type="file" accept="image/*,.pdf" onChange={handleChange} className={inputClass()} />
          </Field>

          <Field label="Identidade">
            <input name="identidade" type="file" accept="image/*,.pdf" onChange={handleChange} className={inputClass()} />
          </Field>

          <Field label="Outros">
            <input name="outros" type="file" accept="image/*,.pdf" onChange={handleChange} className={inputClass()} />
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
        {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Cadastrar cliente"}
      </button>
    </form>
  );
}
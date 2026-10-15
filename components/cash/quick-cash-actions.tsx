"use client";

import { useState, useTransition } from "react";
import { ArrowDownLeft, ArrowUpRight, X, Save } from "lucide-react";
import { registerPortfolioEntryAction } from "@/app/portfolio-entry-actions";

type Mode = "entrada" | "saida" | null;

const options = {
  entrada: [
    { value: "APORTE", label: "Aporte dos sócios" },
    { value: "CREDITO", label: "Empréstimo recebido" },
    { value: "OUTRA_ENTRADA", label: "Outra entrada" },
  ],
  saida: [
    { value: "DESPESA", label: "Despesa operacional" },
    { value: "AMORTIZACAO_DIVIDA", label: "Pagamento de dívida (principal)" },
    { value: "JUROS_FINANCIAMENTO", label: "Juros do financiamento" },
    { value: "RETIRADA", label: "Retirada dos sócios" },
    { value: "OUTRA_SAIDA", label: "Outra saída" },
  ],
};

export function QuickCashActions({ today }: { today: string }) {
  const [mode, setMode] = useState<Mode>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [entryKind, setEntryKind] = useState("");
  function toggle(next: Exclude<Mode, null>) {
    setError("");
    setEntryKind(options[next][0].value);
    setMode(current => current === next ? null : next);
  }
  function submit(formData: FormData) {
    setError("");
    startTransition(async () => {
      try {
        await registerPortfolioEntryAction(formData);
        setMode(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Não foi possível salvar o lançamento.");
      }
    });
  }

  return <section className="cash-panel cash-operations" aria-label="Movimentar caixa">
    <div className="cash-section-head">
      <div>
        <h2>Movimentar caixa</h2>
        <p className="muted">Registre apenas entradas e saídas que não vêm de pagamentos dos clientes.</p>
      </div>
    </div>
    <div className="cash-action-buttons">
      <button type="button" className={"cash-action cash-action-in" + (mode === "entrada" ? " cash-action-active" : "")}
        aria-expanded={mode === "entrada"} onClick={() => toggle("entrada")}>
        <ArrowDownLeft size={18} aria-hidden="true" /> Entrada
      </button>
      <button type="button" className={"cash-action cash-action-out" + (mode === "saida" ? " cash-action-active" : "")}
        aria-expanded={mode === "saida"} onClick={() => toggle("saida")}>
        <ArrowUpRight size={18} aria-hidden="true" /> Saída / gasto
      </button>
    </div>

    {mode && <form action={submit} className="cash-quick-form" key={mode}>
      <div className="cash-form-title">
        <strong>{mode === "entrada" ? "Nova entrada" : "Nova saída"}</strong>
        <button type="button" className="cash-text-button" onClick={() => { setMode(null);setError(""); }} aria-label="Fechar formulário">
          <X size={18} aria-hidden="true"/>
        </button>
      </div>
      <div className="field">
        <label htmlFor="cash-kind">Categoria</label>
        <select className="select" id="cash-kind" name="kind" required value={entryKind} onChange={e=>setEntryKind(e.target.value)}>
          {options[mode].map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="cash-form-row">
        <div className="field">
          <label htmlFor="cash-amount">Valor (R$)</label>
          <input className="input" id="cash-amount" name="amount" type="number" step="0.01" min="0.01" placeholder="0,00" required />
        </div>
        <div className="field">
          <label htmlFor="cash-date">Data</label>
          <input className="input" id="cash-date" name="entry_date" type="date" defaultValue={today} required />
        </div>
      </div>
      <div className="field">
        <label htmlFor="cash-description">Descrição</label>
        <input className="input" id="cash-description" name="description" placeholder={mode === "entrada" ? "De onde veio o dinheiro?" : "Para onde foi o dinheiro?"} maxLength={240} required />
      </div>
      {entryKind === "AMORTIZACAO_DIVIDA" && <div className="muted cash-hint">Lance os juros da parcela separadamente em “Juros do financiamento”.</div>}
      {error && <p role="alert" className="cash-form-error">{error}</p>}
      <button className="btn cash-submit" type="submit" disabled={pending}><Save size={16} aria-hidden="true"/>{pending ? "Salvando..." : "Salvar movimentação"}</button>
    </form>}
    <p className="cash-tiny muted">Empréstimos concedidos e pagamentos recebidos já movimentam o caixa automaticamente.</p>
  </section>;
}

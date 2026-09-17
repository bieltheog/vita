"use client";

import { useState, useTransition } from "react";
import { CircleCheckBig } from "lucide-react";
import { finalizeLoanAction } from "@/app/loan-finalization-actions";
import { money } from "@/lib/finance";

export function FinalizeLoanButton({
  loanId,
  loanCode,
  remainingBalance,
  compact = false,
}: {
  loanId: string;
  loanCode: string;
  remainingBalance: number;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  function confirm() {
    setError("");
    const form = new FormData();
    form.set("loan_id", loanId);
    start(async () => {
      const result = await finalizeLoanAction(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  }

  return <>
    <button
      className={compact ? "icon-btn" : "btn secondary"}
      type="button"
      title="Finalizar empréstimo"
      onClick={() => setOpen(true)}
    >
      <CircleCheckBig size={15}/>{compact ? null : " Finalizar"}
    </button>
    {open ? <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true" aria-labelledby={`finalize-loan-title-${loanId}`} style={{ maxWidth: 500 }}>
      <div className="section-title">
        <div><h2 id={`finalize-loan-title-${loanId}`}>Finalizar empréstimo</h2><div className="muted" style={{ fontSize: 12 }}>{loanCode}</div></div>
        <button className="icon-btn" type="button" aria-label="Fechar" onClick={() => setOpen(false)}>×</button>
      </div>
      <div className="alert" style={{ marginTop: 14 }}>
        O empréstimo será marcado como <strong>FINALIZADO</strong>. Todos os pagamentos já registrados continuarão no histórico e não serão alterados ou apagados.
      </div>
      {remainingBalance > 0.005 ? <div className="alert" style={{ marginTop: 10, borderColor: "rgba(255,166,0,.4)" }}>
        Ainda existe saldo de <strong>{money(remainingBalance)}</strong>. Ao finalizar, a operação deixará de compor o capital em circulação e esse saldo sairá das cobranças ativas e do calendário.
      </div> : <div className="alert" style={{ marginTop: 10 }}>
        O saldo está quitado. A operação deixará de compor o capital em circulação no dashboard.
      </div>}
      {error ? <div className="alert" role="alert" style={{ marginTop: 10, borderColor: "rgba(255,98,109,.35)", color: "#ff9aa2" }}>{error}</div> : null}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <button className="btn secondary" type="button" onClick={() => setOpen(false)} disabled={pending}>Voltar</button>
        <button className="btn" type="button" onClick={confirm} disabled={pending}>{pending ? "Finalizando..." : "Confirmar finalização"}</button>
      </div>
    </div></div> : null}
  </>;
}

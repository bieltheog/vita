"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil, X } from "lucide-react";
import { updateLoanAction } from "@/app/loan-actions";
import { calculateLoan, money, splitInstallments } from "@/lib/finance";
import type { Loan } from "@/lib/types";

export function EditLoanForm({ loan }: { loan: Loan }) {
  const initialType: "percentage" | "fixed" = loan.fixed_return_amount != null ? "fixed" : "percentage";
  const initialReturn = initialType === "fixed" ? Number(loan.fixed_return_amount || 0) : Number(loan.return_percentage || 0);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [principal, setPrincipal] = useState(Number(loan.principal_amount));
  const [returnValue, setReturnValue] = useState(initialReturn);
  const [type, setType] = useState<"percentage" | "fixed">(initialType);
  const [count, setCount] = useState(Number(loan.installment_count));

  const calc = useMemo(() => calculateLoan(principal || 0, type, returnValue || 0), [principal, type, returnValue]);
  const installments = splitInstallments(calc.totalReceivable, count || 1);

  async function submit(formData: FormData) {
    setError("");
    start(async () => {
      try {
        await updateLoanAction(formData);
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao editar empréstimo.");
      }
    });
  }

  return <>
    <button className="icon-btn" title="Editar empréstimo" onClick={() => setOpen(true)}><Pencil size={15}/></button>
    {open && <div className="modal-backdrop"><div className="modal">
      <div className="section-title">
        <div><h2>Editar empréstimo</h2><div className="muted" style={{fontSize:12}}>{loan.loan_code} · {loan.client?.name || "Cliente"}</div></div>
        <button className="icon-btn" onClick={() => setOpen(false)}><X size={17}/></button>
      </div>
      <div className="alert" style={{marginTop:14}}>Se já houver pagamento registrado, valores e calendário ficam protegidos para não alterar o histórico. Nesse caso, apenas o status poderá ser atualizado.</div>
      <form action={submit} className="form-grid" style={{marginTop:14}}>
        <input type="hidden" name="loan_id" value={loan.id}/>
        <div className="field"><label>Valor emprestado *</label><input className="input" name="principal_amount" type="number" min="0.01" step="0.01" value={principal} onChange={e=>setPrincipal(Number(e.target.value))} required/></div>
        <div className="field"><label>Tipo de cálculo</label><select className="select" name="calculation_type" value={type} onChange={e=>setType(e.target.value as "percentage"|"fixed")}><option value="percentage">Porcentagem de retorno</option><option value="fixed">Valor fixo de retorno</option></select></div>
        <div className="field"><label>{type === "percentage" ? "Retorno (%)" : "Lucro fixo (R$)"}</label><input className="input" name="return_value" type="number" min="0" step="0.01" value={returnValue} onChange={e=>setReturnValue(Number(e.target.value))}/></div>
        <div className="field"><label>Forma de pagamento</label><select className="select" name="payment_frequency" defaultValue={loan.payment_frequency}><option value="UNICO">Pagamento único</option><option value="DIARIO">Diário</option><option value="SEMANAL">Semanal</option><option value="QUINZENAL">Quinzenal</option><option value="MENSAL">Mensal</option></select></div>
        <div className="field"><label>Número de parcelas</label><input className="input" name="installment_count" type="number" min="1" value={count} onChange={e=>setCount(Math.max(1, Number(e.target.value)))}/></div>
        <div className="field"><label>Status</label><select className="select" name="status" defaultValue={loan.status}><option value="ATIVO">Ativo</option><option value="FINALIZADO">Finalizado</option><option value="CANCELADO">Cancelado</option></select></div>
        <div className="field"><label>Data do empréstimo *</label><input className="input" name="start_date" type="date" defaultValue={loan.start_date} required/></div>
        <div className="field"><label>Primeiro pagamento *</label><input className="input" name="first_due_date" type="date" defaultValue={loan.first_due_date} required/></div>
        <div className="field full"><div className="card" style={{background:"#090c11"}}><div className="grid-equal"><div><div className="muted" style={{fontSize:11}}>Lucro esperado</div><strong>{money(calc.expectedProfit)}</strong></div><div><div className="muted" style={{fontSize:11}}>Total a receber</div><strong>{money(calc.totalReceivable)}</strong></div></div><div className="divider"/><div className="muted" style={{fontSize:12}}>{count}x de aproximadamente <strong style={{color:"white"}}>{money(installments[0] || 0)}</strong></div></div></div>
        {error && <div className="field full"><div className="alert">{error}</div></div>}
        <div className="field full" style={{flexDirection:"row",justifyContent:"flex-end"}}><button type="button" className="btn secondary" onClick={()=>setOpen(false)}>Cancelar</button><button className="btn" disabled={pending}>{pending ? "Salvando..." : "Salvar alterações"}</button></div>
      </form>
    </div></div>}
  </>;
}

"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, X } from "lucide-react";
import { registerPaymentAction } from "@/app/actions";
import { registerInterestOnlyAction } from "@/app/interest-only-actions";
import { money } from "@/lib/finance";
import { brazilDateKey } from "@/lib/date";
import type { Installment } from "@/lib/types";

type PaymentMode = "NORMAL" | "JUROS";

export function PaymentForm({ installments, demo=false, compact=false }: { installments: Installment[]; demo?: boolean; compact?: boolean }) {
  const router=useRouter();
  const [open,setOpen]=useState(false);
  const [pending,start]=useTransition();
  const [error,setError]=useState("");
  const [mode,setMode]=useState<PaymentMode>("NORMAL");
  const [selected,setSelected]=useState("");
  const [search,setSearch]=useState("");
  const [amount,setAmount]=useState("");
  const [paymentDate,setPaymentDate]=useState(()=>brazilDateKey());

  const openInstallments=useMemo(
    ()=>installments.filter(i=>i.stored_status!=="CANCELADO"&&Number(i.remaining_amount)>0&&i.loan?.status==="ATIVO"),
    [installments],
  );

  const openCountByLoan=useMemo(()=>{
    const map=new Map<string,number>();
    openInstallments.forEach(i=>map.set(i.loan_id,(map.get(i.loan_id)||0)+1));
    return map;
  },[openInstallments]);

  const interestChoices=useMemo(()=>openInstallments.filter(i=>{
    const loan=i.loan;
    if(!loan?.principal_amount)return false;
    if(!["UNICO","MENSAL"].includes(loan.payment_frequency||""))return false;
    if((openCountByLoan.get(i.loan_id)||0)!==1)return false;
    if(Number(i.amount_paid)>0.005)return false;
    if(Math.abs(Number(i.remaining_amount)-Number(i.amount))>0.005)return false;
    const interest=Number(loan.fixed_return_amount ?? (Number(loan.principal_amount||0)*Number(loan.return_percentage||0)/100));
    return interest>0&&Math.abs(Number(i.amount)-(Number(loan.principal_amount||0)+interest))<=0.01;
  }),[openInstallments,openCountByLoan]);

  const baseChoices=mode==="JUROS"?interestChoices:openInstallments;
  const normalize=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const choices=search.trim()
    ? baseChoices.filter(i=>i.id===selected||normalize(`${i.client?.name||""} ${i.loan?.loan_code||""}`).includes(normalize(search.trim())))
    : baseChoices;
  const current=choices.find(i=>i.id===selected);
  const interest=current?.loan
    ? Number(current.loan.fixed_return_amount ?? (Number(current.loan.principal_amount||0)*Number(current.loan.return_percentage||0)/100))
    : 0;

  function close(){
    setOpen(false);
    setError("");
    setMode("NORMAL");
    setSelected("");
    setSearch("");
    setAmount("");
    setPaymentDate(brazilDateKey());
  }

  function select(id:string){
    setSelected(id);
    const row=baseChoices.find(i=>i.id===id);
    setAmount(row?Number(row.remaining_amount).toFixed(2):"");
  }

  function changeMode(next:PaymentMode){
    setMode(next);
    setError("");
    setSelected("");
    setAmount("");
  }

  async function submit(formData:FormData){
    setError("");
    start(async()=>{
      try{
        if(mode==="JUROS") await registerInterestOnlyAction(formData);
        else await registerPaymentAction(formData);
        close();
        router.refresh();
      }catch(e){
        setError(e instanceof Error?e.message:"Erro ao registrar pagamento");
      }
    });
  }

  return <>
    <button className={compact?"btn secondary":"btn"} onClick={()=>setOpen(true)}><CreditCard size={16}/> Registrar pagamento</button>
    {open&&<div className="modal-backdrop"><div className="modal">
      <div className="section-title"><div><h2>Registrar pagamento</h2><div className="muted text-sm">Pagamento menor que o saldo continua sendo registrado automaticamente como parcial.</div></div><button type="button" className="icon-btn" onClick={close}><X size={17}/></button></div>
      {demo&&<div className="alert">Modo demonstração: configure o Supabase para registrar pagamentos.</div>}
      <form action={submit} className="form-grid form-gap">
        <div className="field full"><label>Tipo de pagamento</label><select className="select" value={mode} onChange={e=>changeMode(e.target.value as PaymentMode)}>
          <option value="NORMAL">Pagamento normal</option>
          <option value="JUROS">Somente juros</option>
        </select></div>

        <div className="field full"><label>Buscar cliente ou empréstimo</label><input className="input" type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Digite o nome ou o código..."/></div>

        <div className="field full"><label>Parcela *</label><select className="select" name="installment_id" value={selected} onChange={e=>select(e.target.value)} required><option value="">{choices.length?"Selecione":"Nenhuma parcela encontrada"}</option>{choices.map(i=><option key={i.id} value={i.id}>{i.client?.name} · {i.loan?.loan_code} · {i.installment_number}/{i.loan?.installment_count} · saldo {money(i.remaining_amount)}</option>)}</select></div>

        {mode==="NORMAL"
          ? <div className="field"><label>Valor recebido *</label><input className="input" name="amount" type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} required/>{current&&Number(amount)>0&&Number(amount)<Number(current.remaining_amount)-0.005&&<span className="pay-hint text-orange">Parcial · ficam {money(Number(current.remaining_amount)-Number(amount))} em aberto</span>}</div>
          : current
            ? <div className="field full"><div className="alert"><strong>Somente juros: {money(interest)}.</strong> Esta parcela será quitada como ciclo de juros e uma nova parcela será criada com o valor total de <strong>{money(current.amount)}</strong>, mantendo o principal emprestado.</div></div>
            : <div className="field full"><div className="alert">Nesta opção aparecem apenas contratos compatíveis com renovação por juros. Selecione a parcela para conferir o valor.</div></div>}

        <div className="field"><label>Data *</label><input className="input" name="payment_date" type="date" value={paymentDate} onChange={e=>setPaymentDate(e.target.value)} required/></div>
        <div className="field"><label>Forma de pagamento</label><select className="select" name="payment_method"><option>PIX</option><option>DINHEIRO</option><option value="TRANSFERENCIA">Transferência</option><option>OUTRO</option></select></div>
        <div className="field full"><label>Observação</label><input className="input" name="notes"/></div>

        {error&&<div className="field full"><div className="alert">{error}</div></div>}
        <div className="field full form-actions"><button type="button" className="btn secondary" onClick={close}>Cancelar</button><button className="btn" disabled={pending||demo||!selected}>{pending?"Confirmando...":mode==="JUROS"?"Confirmar somente juros":"Confirmar pagamento"}</button></div>
      </form>
    </div></div>}
  </>;
}

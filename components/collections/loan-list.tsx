"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, History } from "lucide-react";
import { money } from "@/lib/finance";
import { EditLoanForm } from "@/components/forms/edit-loan-form";
import { LoanTopupForm } from "@/components/forms/loan-topup-form";
import type { Installment, Loan } from "@/lib/types";

function norm(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()}
const labels:Record<string,string>={UNICO:"Único",DIARIO:"Diário",SEMANAL:"Semanal",QUINZENAL:"Quinzenal",MENSAL:"Mensal",DATAS_FIXAS:"Datas fixas",PERSONALIZADO:"Datas fixas"};

export function LoanList({loans,installments}:{loans:Loan[];installments:Installment[]}){
  const [query,setQuery]=useState("");const [status,setStatus]=useState("TODOS");const [frequency,setFrequency]=useState("TODAS");
  const rows=useMemo(()=>loans.filter(l=>norm(`${l.loan_code} ${l.client?.name||""}`).includes(norm(query))).filter(l=>status==="TODOS"||l.status===status).filter(l=>frequency==="TODAS"||l.payment_frequency===frequency||(frequency==="DATAS_FIXAS"&&l.payment_frequency==="PERSONALIZADO")),[loans,query,status,frequency]);
  return <div className="card">
    <div className="section-title" style={{gap:10,flexWrap:"wrap"}}><div className="search-box" style={{maxWidth:380,flex:1}}><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Código ou cliente..."/></div><select className="select" value={status} onChange={e=>setStatus(e.target.value)} style={{maxWidth:150}}><option value="TODOS">Todos status</option><option value="ATIVO">Ativos</option><option value="FINALIZADO">Finalizados</option><option value="CANCELADO">Cancelados</option></select><select className="select" value={frequency} onChange={e=>setFrequency(e.target.value)} style={{maxWidth:175}}><option value="TODAS">Todas formas</option><option value="UNICO">Único</option><option value="DIARIO">Diário</option><option value="SEMANAL">Semanal</option><option value="QUINZENAL">Quinzenal</option><option value="MENSAL">Mensal</option><option value="DATAS_FIXAS">Datas fixas</option></select></div>
    <div className="table-wrap"><table><thead><tr><th>Código</th><th>Cliente</th><th>Emprestado</th><th>Lucro</th><th>Total</th><th>Forma</th><th>Parcelas</th><th>Status</th><th>Ações</th></tr></thead><tbody>{rows.map(x=>{const loanInstallments=installments.filter(row=>row.loan_id===x.id);return <tr key={x.id}><td><strong>{x.loan_code}</strong></td><td>{x.client?.name}</td><td>{money(x.principal_amount)}</td><td>{money(x.expected_profit)}</td><td>{money(x.total_receivable)}</td><td>{labels[x.payment_frequency]||x.payment_frequency}</td><td>{x.installment_count}</td><td><span className={`badge ${x.status==='ATIVO'?'green':'gray'}`}>{x.status}</span></td><td><div style={{display:"flex",gap:6}}>{x.status!=="CANCELADO"&&<LoanTopupForm loan={x} installments={loanInstallments} compact/>}<EditLoanForm loan={x} installments={loanInstallments}/><Link className="icon-btn" href={`/emprestimos/${x.id}`} title="Histórico e parcelas"><History size={15}/></Link></div></td></tr>})}</tbody></table></div>
    {!rows.length&&<div className="empty">Nenhum empréstimo encontrado.</div>}
  </div>
}

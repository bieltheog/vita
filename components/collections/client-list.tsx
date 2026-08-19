"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { effectiveInstallmentStatus, money } from "@/lib/finance";
import type { Client, Installment, Loan, Payment } from "@/lib/types";

function norm(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()}

export function ClientList({clients,loans,payments,installments,initialQuery=""}:{clients:Client[];loans:Loan[];payments:Payment[];installments:Installment[];initialQuery?:string}){
  const [query,setQuery]=useState(initialQuery);
  const [filter,setFilter]=useState("TODOS");
  const rows=useMemo(()=>clients.map(c=>{
    const cl=loans.filter(l=>l.client_id===c.id), cp=payments.filter(p=>p.client_id===c.id), ci=installments.filter(i=>i.client_id===c.id);
    const overdue=ci.filter(i=>effectiveInstallmentStatus(i)==="ATRASADO").reduce((s,i)=>s+Number(i.remaining_amount),0);
    const outstanding=ci.reduce((s,i)=>s+Number(i.remaining_amount),0);
    const searchable=norm(`${c.name} ${c.cpf||""} ${c.phone||""} ${c.whatsapp||""} ${c.email||""}`);
    return {c,cl,cp,overdue,outstanding,searchable};
  }).filter(r=>r.searchable.includes(norm(query))).filter(r=>filter==="TODOS"||(filter==="ATIVOS"&&r.cl.some(l=>l.status==="ATIVO"))||(filter==="ATRASADOS"&&r.overdue>0)||(filter==="QUITADOS"&&r.cl.length>0&&r.outstanding<=0)),[clients,loans,payments,installments,query,filter]);
  return <div className="card">
    <div className="section-title" style={{gap:12,flexWrap:"wrap"}}><div className="search-box" style={{maxWidth:430,flex:1}}><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nome, CPF, telefone ou e-mail..."/></div><select className="select" value={filter} onChange={e=>setFilter(e.target.value)} style={{maxWidth:190}}><option value="TODOS">Todos</option><option value="ATIVOS">Com empréstimo ativo</option><option value="ATRASADOS">Com atraso</option><option value="QUITADOS">Quitados</option></select></div>
    <div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Telefone</th><th>Total emprestado</th><th>Total pago</th><th>Saldo</th><th>Atrasado</th><th>Empréstimos</th><th></th></tr></thead><tbody>{rows.map(({c,cl,cp,outstanding,overdue})=><tr key={c.id}><td><strong>{c.name}</strong><div className="person-meta">{c.cpf||"CPF não informado"}</div></td><td>{c.whatsapp||c.phone||"—"}</td><td>{money(cl.reduce((s,l)=>s+Number(l.principal_amount),0))}</td><td>{money(cp.reduce((s,p)=>s+Number(p.amount),0))}</td><td>{money(outstanding)}</td><td><span style={{color:overdue>0?"var(--red)":"inherit"}}>{money(overdue)}</span></td><td>{cl.length}</td><td><Link className="btn secondary" href={`/clientes/${c.id}`}>Ver perfil</Link></td></tr>)}</tbody></table></div>
    {!rows.length&&<div className="empty">Nenhum cliente encontrado com esses filtros.</div>}
  </div>
}

"use client";

import { Download, FileJson, Printer } from "lucide-react";
import { effectiveInstallmentStatus } from "@/lib/finance";
import type { Client, Installment, Loan, Payment } from "@/lib/types";

function download(name:string,content:string,type:string){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;a.click();URL.revokeObjectURL(url)}
function csvValue(value:unknown){const text=String(value??"");return `"${text.replace(/"/g,'""')}"`}

export function ExportButtons({clients,loans,installments,payments}:{clients:Client[];loans:Loan[];installments:Installment[];payments:Payment[]}){
  function backup(){download(`jureminha-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify({version:2,exported_at:new Date().toISOString(),clients,loans,installments,payments},null,2),"application/json;charset=utf-8")}
  function excel(){
    const headers=["Cliente","CPF","Telefone","Empréstimo","Parcela","Vencimento","Valor","Pago","Restante","Status"];
    const lines=installments.map(i=>{const c=clients.find(x=>x.id===i.client_id);return [c?.name,c?.cpf,c?.whatsapp||c?.phone,i.loan?.loan_code,i.installment_number,i.due_date,i.amount,i.amount_paid,i.remaining_amount,effectiveInstallmentStatus(i)].map(csvValue).join(";")});
    download(`jureminha-parcelas-${new Date().toISOString().slice(0,10)}.csv`,`\ufeff${headers.map(csvValue).join(";")}\n${lines.join("\n")}`,"text/csv;charset=utf-8");
  }
  return <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button className="btn secondary" type="button" onClick={excel}><Download size={16}/> Excel (CSV)</button><button className="btn secondary" type="button" onClick={backup}><FileJson size={16}/> Backup JSON</button><button className="btn secondary" type="button" onClick={()=>window.print()}><Printer size={16}/> PDF / Imprimir</button></div>
}

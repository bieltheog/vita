"use client";

import { Printer } from "lucide-react";
import { money } from "@/lib/finance";

export function ReceiptButton({
  clientName,
  loanCode,
  amount,
  paymentDate,
  paymentMethod,
  remaining,
}: {
  clientName: string;
  loanCode?: string | null;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  remaining?: number | null;
}) {
  function printReceipt() {
    const popup = window.open("", "_blank", "width=700,height=760");
    if (!popup) return;
    const safe = (value: string) => value.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c] || c));
    popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Recibo Jureminha</title><style>body{font-family:Arial,sans-serif;padding:40px;color:#111}.box{max-width:620px;margin:auto;border:1px solid #ddd;border-radius:14px;padding:28px}h1{margin:0 0 6px;font-size:25px}.muted{color:#666}.row{display:flex;justify-content:space-between;gap:20px;padding:12px 0;border-bottom:1px solid #eee}.value{font-weight:700}.total{font-size:24px;margin:22px 0}.footer{margin-top:35px;font-size:12px;color:#777}@media print{button{display:none}.box{border:0}}</style></head><body><div class="box"><h1>Recibo de pagamento</h1><div class="muted">Jureminha 2.0</div><div class="total">${safe(money(amount))}</div><div class="row"><span>Cliente</span><span class="value">${safe(clientName)}</span></div><div class="row"><span>Empréstimo</span><span class="value">${safe(loanCode || "—")}</span></div><div class="row"><span>Data</span><span class="value">${safe(paymentDate)}</span></div><div class="row"><span>Forma</span><span class="value">${safe(paymentMethod)}</span></div>${remaining != null ? `<div class="row"><span>Saldo da parcela após pagamento</span><span class="value">${safe(money(remaining))}</span></div>` : ""}<div class="footer">Recibo gerado pelo Jureminha 2.0. Use a opção de impressão do navegador para imprimir ou salvar em PDF.</div><button onclick="window.print()" style="margin-top:22px;padding:10px 16px;border-radius:8px;border:0;cursor:pointer">Imprimir / Salvar PDF</button></div></body></html>`);
    popup.document.close();
  }
  return <button type="button" className="icon-btn" title="Recibo / PDF" onClick={printReceipt}><Printer size={15}/></button>;
}

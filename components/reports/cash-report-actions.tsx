"use client";

import { FileDown, Printer } from "lucide-react";

export type ReportMovement = {
  date: string;
  category: string;
  description: string;
  direction: "ENTRADA" | "SAIDA";
  amount: number;
  balanceAfter: number;
};

function csvField(value: string | number) {
  const raw = String(value);
  // Impede que nomes e descrições sejam interpretados como fórmulas no Excel.
  const safe = /^\s*[=+\-@\t\r]/.test(raw) ? "'" + raw : raw;
  return '"' + safe.replace(/"/g, '""') + '"';
}

export function CashReportActions({
  portfolioId, start, end, reconciled, rows
}: {
  portfolioId: number;
  start: string;
  end: string;
  reconciled: boolean;
  rows: ReportMovement[];
}) {
  function downloadCsv() {
    const columns = [
      ["Data", "Categoria", "Descrição", "Entrada (R$)", "Saída (R$)", "Saldo após (R$)"],
      ...rows.map(row => [
        row.date.split("-").reverse().join("/"),
        row.category,
        row.description,
        row.direction === "ENTRADA" ? row.amount.toFixed(2).replace(".", ",") : "",
        row.direction === "SAIDA" ? row.amount.toFixed(2).replace(".", ",") : "",
        reconciled ? row.balanceAfter.toFixed(2).replace(".", ",") : "Não conciliado"
      ])
    ];
    const content = "\uFEFF" + columns.map(row => row.map(csvField).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "jureminha-carteira-" + portfolioId + "-" + start + "-a-" + end + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  return <div className="cash-report-actions cash-report-screen-only">
    <button type="button" className="btn secondary" onClick={downloadCsv}><FileDown size={16} /> Baixar CSV</button>
    <button type="button" className="btn" onClick={() => window.print()}><Printer size={16} /> Imprimir / salvar PDF</button>
  </div>;
}

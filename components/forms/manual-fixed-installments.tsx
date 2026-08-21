"use client";

import { money } from "@/lib/finance";

export type ManualFixedRow = { date: string; amount: string };

export function ManualFixedInstallments({
  rows,
  total,
  onChange,
  onSplitEqually,
}: {
  rows: ManualFixedRow[];
  total: number;
  onChange: (rows: ManualFixedRow[]) => void;
  onSplitEqually: () => void;
}) {
  const configured = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const difference = Math.round((total - configured) * 100) / 100;

  function update(index: number, patch: Partial<ManualFixedRow>) {
    onChange(rows.map((row, i) => i === index ? { ...row, ...patch } : row));
  }

  return <div className="field full">
    <div className="card" style={{background:"#090c11"}}>
      <div className="section-title" style={{marginBottom:12}}>
        <div>
          <strong>Datas e valores das parcelas</strong>
          <div className="muted" style={{fontSize:12,marginTop:3}}>Informe manualmente o vencimento e o valor de cada parcela.</div>
        </div>
        <button type="button" className="btn secondary" onClick={onSplitEqually}>Dividir igualmente</button>
      </div>
      <div style={{display:"grid",gap:10}}>
        {rows.map((row,index)=><div key={index} className="manual-fixed-row">
          <div className="muted" style={{fontSize:12,paddingBottom:11}}>Parcela {index+1}</div>
          <div className="field"><label>Data *</label><input className="input" name={`fixed_due_date_${index}`} type="date" value={row.date} onChange={e=>update(index,{date:e.target.value})} required/></div>
          <div className="field"><label>Valor *</label><input className="input" name={`fixed_amount_${index}`} type="number" min="0.01" step="0.01" value={row.amount} onChange={e=>update(index,{amount:e.target.value})} required/></div>
        </div>)}
      </div>
      <div className="divider"/>
      <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",fontSize:12}}>
        <span className="muted">Total a receber: <strong style={{color:"white"}}>{money(total)}</strong></span>
        <span className="muted">Total das parcelas: <strong style={{color:"white"}}>{money(configured)}</strong></span>
        <span className="muted">Diferença: <strong style={{color:Math.abs(difference)<0.01?"var(--green)":"var(--red)"}}>{money(difference)}</strong></span>
      </div>
    </div>
  </div>;
}

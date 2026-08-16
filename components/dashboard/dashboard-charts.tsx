"use client";
import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { effectiveInstallmentStatus, money } from "@/lib/finance";
import type { Installment, Payment } from "@/lib/types";

export function DashboardCharts({ installments, payments }: { installments: Installment[]; payments: Payment[] }) {
  const receivedData = useMemo(() => {
    return Array.from({length:6},(_,idx)=>subMonths(new Date(),5-idx)).map(date=>{
      const key=format(date,"yyyy-MM");
      const previsto=installments.filter(i=>i.due_date.startsWith(key)).reduce((s,i)=>s+Number(i.amount),0);
      const recebido=payments.filter(p=>p.payment_date.startsWith(key)).reduce((s,p)=>s+Number(p.amount),0);
      return { name: format(date,"MMM",{locale:ptBR}).toUpperCase(), previsto, recebido };
    });
  },[installments,payments]);

  const situation = useMemo(()=>{
    const counts={PAGO:0,PENDENTE:0,ATRASADO:0,PARCIAL:0};
    installments.forEach(i=>{const s=effectiveInstallmentStatus(i); if(s in counts) counts[s as keyof typeof counts]++;});
    return [
      {name:"Pago",value:counts.PAGO,fill:"#2bd889"},
      {name:"Pendente",value:counts.PENDENTE,fill:"#f8c451"},
      {name:"Atrasado",value:counts.ATRASADO,fill:"#ff626d"},
      {name:"Parcial",value:counts.PARCIAL,fill:"#ff984d"},
    ];
  },[installments]);

  return <div className="grid-2">
    <div className="card"><div className="section-title"><div><h2>Recebimentos</h2><div className="muted" style={{fontSize:12}}>Previsto x recebido nos últimos 6 meses</div></div></div><div className="chart-box"><ResponsiveContainer width="100%" height="100%"><AreaChart data={receivedData}><defs><linearGradient id="expected" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#7c5cff" stopOpacity={0.28}/><stop offset="95%" stopColor="#7c5cff" stopOpacity={0}/></linearGradient><linearGradient id="received" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2bd889" stopOpacity={0.20}/><stop offset="95%" stopColor="#2bd889" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="rgba(255,255,255,.05)" vertical={false}/><XAxis dataKey="name" stroke="#707886" fontSize={11} tickLine={false} axisLine={false}/><YAxis stroke="#707886" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v=>`${Math.round(v/1000)}k`}/><Tooltip contentStyle={{background:"#0e1218",border:"1px solid rgba(255,255,255,.09)",borderRadius:12}} formatter={(v)=>money(Number(v))}/><Legend/><Area type="monotone" dataKey="previsto" name="Previsto" stroke="#7c5cff" fill="url(#expected)" strokeWidth={2}/><Area type="monotone" dataKey="recebido" name="Recebido" stroke="#2bd889" fill="url(#received)" strokeWidth={2}/></AreaChart></ResponsiveContainer></div></div>
    <div className="card"><div className="section-title"><div><h2>Situação dos pagamentos</h2><div className="muted" style={{fontSize:12}}>Distribuição das parcelas</div></div></div><div className="chart-box"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={situation} dataKey="value" nameKey="name" innerRadius={66} outerRadius={94} paddingAngle={3}>{situation.map((entry)=><Cell key={entry.name} fill={entry.fill}/>)}</Pie><Tooltip contentStyle={{background:"#0e1218",border:"1px solid rgba(255,255,255,.09)",borderRadius:12}}/><Legend/></PieChart></ResponsiveContainer></div></div>
  </div>;
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownCircle, ArrowUpCircle, CalendarClock, CheckCircle2, PiggyBank,
  RotateCcw, Save, ShieldCheck, Sparkles, TrendingUp, WalletCards,
} from "lucide-react";
import {
  createCashDebtAction, createCashEntryAction, payCashDebtAction,
  saveCashAccountAction, unpayCashDebtAction, voidCashEntryAction,
} from "@/app/cash-actions";
import { money } from "@/lib/finance";
import type { CashDebt } from "@/lib/types";

export type CashMovement = {
  id: string;
  date: string;
  title: string;
  description: string;
  amount: number;
  source: "manual" | "loan" | "payment";
  voided?: boolean;
};

export type CashSummary = {
  openingBalance: number;
  reserveAmount: number;
  trackingStartDate: string;
  available: number;
  lendable: number;
  manualIncome: number;
  paymentsReceived: number;
  manualExpenses: number;
  loansGranted: number;
  totalReceivable: number;
  pendingDebtAmount: number;
};

export type CashForecastDay = {
  date: string;
  income: number;
  outflow: number;
  balance: number;
  receivable: number;
  debts: number;
  otherIncome: number;
  otherOutflow: number;
};

export type CashForecast = {
  horizonDate: string;
  projectedBalance: number;
  safeLend: number;
  receivable: number;
  debts: number;
  otherIncome: number;
  otherOutflow: number;
  days: CashForecastDay[];
};

function dateBR(date:string){
  try{return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR");}catch{return date;}
}

export function CashManager({
  summary, movements, debts, configured, today, forecast,
}: {
  summary: CashSummary;
  movements: CashMovement[];
  debts: CashDebt[];
  configured: boolean;
  today: string;
  forecast?: CashForecast;
}) {
  const router=useRouter();
  const [pending,start]=useTransition();
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [type,setType]=useState<"ENTRADA"|"GASTO">("ENTRADA");

  function run(action:(fd:FormData)=>Promise<{ok:true;message?:string}|{ok:false;error:string}>,fd:FormData){
    setMessage("");setError("");
    start(async()=>{
      const result=await action(fd);
      if(!result.ok){setError(result.error);return;}
      setMessage(result.message||"Salvo.");
      router.refresh();
    });
  }

  function saveConfig(formData:FormData){run(saveCashAccountAction,formData)}
  function addEntry(formData:FormData){run(createCashEntryAction,formData)}
  function addDebt(formData:FormData){run(createCashDebtAction,formData)}
  function payDebt(id:string,paymentDate:string){const fd=new FormData();fd.set("debt_id",id);fd.set("payment_date",paymentDate);run(payCashDebtAction,fd)}
  function unpayDebt(id:string){
    if(!window.confirm("Desfazer o pagamento desta dívida? O valor voltará ao caixa e o histórico será mantido."))return;
    const fd=new FormData();fd.set("debt_id",id);run(unpayCashDebtAction,fd);
  }
  function undo(id:string){
    if(!window.confirm("Estornar esta movimentação? Ela continuará no histórico."))return;
    const fd=new FormData();fd.set("entry_id",id);run(voidCashEntryAction,fd);
  }

  const totalIncome=summary.manualIncome+summary.paymentsReceived;
  const totalOut=summary.manualExpenses+summary.loansGranted;
  const sortedDebts=[...debts].sort((a,b)=>{
    if(a.status!==b.status){if(a.status==="PENDENTE")return -1;if(b.status==="PENDENTE")return 1;}
    return a.due_date.localeCompare(b.due_date);
  });

  return <>
    {!configured&&<div className="alert" style={{marginBottom:16}}>
      <strong>Configure seu ponto de partida.</strong> Informe quanto dinheiro você tinha disponível na data em que quer começar o controle. A partir daí, o Jureminha soma entradas e pagamentos e desconta gastos e novos empréstimos automaticamente.
    </div>}
    {error&&<div className="alert alert-error" style={{marginBottom:14}}>{error}</div>}
    {message&&<div className="alert alert-success" style={{marginBottom:14}}>{message}</div>}

    <div className="stats cash-primary-stats">
      <div className="card premium-stat"><div className="stat-label"><span>Saldo disponível</span><span className="stat-icon green"><PiggyBank size={17}/></span></div><div className="stat-value" style={{color:summary.available<0?"var(--red)":"var(--green)"}}>{money(summary.available)}</div><div className="stat-meta">Dinheiro livre calculado até hoje</div></div>
      <div className="card premium-stat"><div className="stat-label"><span>Pode emprestar agora</span><span className="stat-icon"><ArrowUpCircle size={17}/></span></div><div className="stat-value">{money(summary.lendable)}</div><div className="stat-meta">Saldo disponível menos sua reserva</div></div>
      <div className="card premium-stat"><div className="stat-label"><span>Entradas realizadas</span><span className="stat-icon blue"><ArrowDownCircle size={17}/></span></div><div className="stat-value">{money(totalIncome)}</div><div className="stat-meta">{money(summary.manualIncome)} manual + {money(summary.paymentsReceived)} recebido</div></div>
      <div className="card premium-stat"><div className="stat-label"><span>Saídas realizadas</span><span className="stat-icon orange"><ArrowUpCircle size={17}/></span></div><div className="stat-value">{money(totalOut)}</div><div className="stat-meta">{money(summary.manualExpenses)} gastos + {money(summary.loansGranted)} empréstimos</div></div>
    </div>

    {forecast&&<div className="card forecast-card" style={{marginTop:16}}>
      <div className="section-title forecast-head">
        <div><div className="eyebrow">Planejamento</div><h2>Previsão de caixa · próximos 30 dias</h2><div className="muted" style={{fontSize:12}}>Cruza parcelas a receber, dívidas, gastos agendados e empréstimos futuros. O saldo projetado pressupõe que os recebimentos previstos entrem nas datas.</div></div>
        <span className="forecast-chip"><Sparkles size={14}/> até {dateBR(forecast.horizonDate)}</span>
      </div>
      <div className="forecast-grid">
        <div className="forecast-metric"><span>A receber</span><strong className="money-positive">{money(forecast.receivable)}</strong><small>parcelas previstas em 30 dias</small></div>
        <div className="forecast-metric"><span>Compromissos</span><strong className="money-negative">{money(forecast.debts+forecast.otherOutflow)}</strong><small>dívidas + saídas já agendadas</small></div>
        <div className="forecast-metric featured"><span>Saldo projetado</span><strong>{money(forecast.projectedBalance)}</strong><small>se os recebimentos ocorrerem como previsto</small></div>
        <div className="forecast-metric safe"><span><ShieldCheck size={14}/> Livre com segurança</span><strong>{money(forecast.safeLend)}</strong><small>sem usar a reserva nem o valor das dívidas próximas</small></div>
      </div>
      <div className="projection-list">
        {forecast.days.length?forecast.days.slice(0,14).map(day=><div className="projection-row" key={day.date}>
          <div className="projection-date"><strong>{dateBR(day.date)}</strong><span>{day.receivable>0?`${money(day.receivable)} a receber`:""}{day.receivable>0&&day.debts>0?" · ":""}{day.debts>0?`${money(day.debts)} em dívidas`:""}</span></div>
          <div className="projection-flows"><span className="money-positive">+ {money(day.income)}</span><span className="money-negative">- {money(day.outflow)}</span></div>
          <div className="projection-balance"><span>saldo previsto</span><strong className={day.balance<0?"money-negative":""}>{money(day.balance)}</strong></div>
        </div>):<div className="empty compact">Nenhuma entrada ou saída agendada nos próximos 30 dias.</div>}
      </div>
    </div>}

    <div className="grid-equal cash-config-grid" style={{marginTop:16}}>
      <div className="card">
        <div className="section-title"><div><h2>Configuração do caixa</h2><div className="muted" style={{fontSize:12}}>Defina o saldo de partida e, se quiser, uma reserva que não deve ser emprestada.</div></div><WalletCards size={19} className="section-icon"/></div>
        <form action={saveConfig} className="form-grid">
          <div className="field"><label>Saldo inicial disponível</label><input className="input" type="number" min="0" step="0.01" name="opening_balance" defaultValue={summary.openingBalance}/></div>
          <div className="field"><label>Data de início do controle</label><input className="input" type="date" name="tracking_start_date" defaultValue={summary.trackingStartDate||today}/></div>
          <div className="field full"><label>Reserva que não quer emprestar (opcional)</label><input className="input" type="number" min="0" step="0.01" name="reserve_amount" defaultValue={summary.reserveAmount}/></div>
          <div className="field full"><button className="btn" disabled={pending}><Save size={16}/>{pending?"Salvando...":"Salvar configuração"}</button></div>
        </form>
      </div>

      <div className="card">
        <div className="section-title"><div><h2>Nova movimentação</h2><div className="muted" style={{fontSize:12}}>Use para aportes, entradas extras, gastos, retiradas e outros movimentos fora dos empréstimos.</div></div><TrendingUp size={19} className="section-icon"/></div>
        <form action={addEntry} className="form-grid">
          <div className="field"><label>Tipo</label><select className="select" name="entry_type" value={type} onChange={e=>setType(e.target.value as "ENTRADA"|"GASTO")}><option value="ENTRADA">Entrada (+)</option><option value="GASTO">Gasto / retirada (-)</option></select></div>
          <div className="field"><label>Categoria</label><select className="select" name="category" defaultValue={type==="ENTRADA"?"APORTE":"GASTO_GERAL"} key={type}><option value="APORTE">Aporte</option><option value="RECEITA_EXTRA">Receita extra</option><option value="GASTO_GERAL">Gasto geral</option><option value="RETIRADA">Retirada pessoal</option><option value="TAXA">Taxa</option><option value="AJUSTE">Ajuste</option><option value="OUTRO">Outro</option></select></div>
          <div className="field"><label>Valor</label><input className="input" type="number" min="0.01" step="0.01" name="amount" required/></div>
          <div className="field"><label>Data</label><input className="input" type="date" name="entry_date" defaultValue={today} required/></div>
          <div className="field full"><label>Descrição</label><input className="input" name="description" placeholder={type==="ENTRADA"?"Ex.: aporte de capital":"Ex.: combustível, retirada, taxa..."}/></div>
          <div className="field full"><button className="btn" disabled={pending}>{type==="ENTRADA"?<ArrowDownCircle size={16}/>:<ArrowUpCircle size={16}/>} {pending?"Salvando...":type==="ENTRADA"?"Adicionar entrada":"Registrar gasto"}</button></div>
        </form>
      </div>
    </div>

    <div className="card debt-card" style={{marginTop:16}}>
      <div className="section-title"><div><div className="eyebrow">Compromissos</div><h2>Dívidas a pagar</h2><div className="muted" style={{fontSize:12}}>Agende compromissos futuros. A dívida só sai do saldo quando você marcar como paga.</div></div><span className="badge gray">Pendente: {money(summary.pendingDebtAmount)}</span></div>
      <form action={addDebt} className="form-grid" style={{marginBottom:16}}>
        <div className="field"><label>Descrição da dívida</label><input className="input" name="title" placeholder="Ex.: parcela do carro" required/></div>
        <div className="field"><label>Valor</label><input className="input" type="number" min="0.01" step="0.01" name="amount" placeholder="1700,00" required/></div>
        <div className="field"><label>Vencimento</label><input className="input" type="date" name="due_date" required/></div>
        <div className="field"><label>Observação</label><input className="input" name="notes" placeholder="Opcional"/></div>
        <div className="field full"><button className="btn" disabled={pending}><CalendarClock size={16}/>{pending?"Salvando...":"Adicionar dívida"}</button></div>
      </form>
      <div className="divider"/>
      <div className="list">
        {sortedDebts.length?sortedDebts.map(debt=>{
          const overdue=debt.status==="PENDENTE"&&debt.due_date<today;
          const label=debt.status==="PAGO"?"Pago":overdue?"Atrasada":debt.status==="CANCELADO"?"Cancelada":"Pendente";
          const badgeClass=debt.status==="PAGO"?"green":overdue?"red":debt.status==="CANCELADO"?"gray":"yellow";
          return <div className="list-row debt-row" key={debt.id}>
            <div className="debt-info"><span className={`debt-dot ${overdue?"overdue":debt.status.toLowerCase()}`}/><div><strong>{debt.title}</strong><div className="person-meta">Vence em {dateBR(debt.due_date)}{debt.notes?` · ${debt.notes}`:""}{debt.payment_date?` · pago em ${dateBR(debt.payment_date)}`:""}</div></div></div>
            <div className="debt-actions">
              <span className={`badge ${badgeClass}`}>{label}</span><strong>{money(Number(debt.amount))}</strong>
              {debt.status==="PENDENTE"&&<form action={(fd)=>{payDebt(debt.id,String(fd.get("payment_date")||today))}} className="debt-pay-form"><input className="input" type="date" name="payment_date" defaultValue={today}/><button className="btn" disabled={pending}><CheckCircle2 size={15}/>Marcar pago</button></form>}
              {debt.status==="PAGO"&&<button className="btn secondary" type="button" disabled={pending} onClick={()=>unpayDebt(debt.id)}><RotateCcw size={15}/>Desfazer</button>}
            </div>
          </div>;
        }):<div className="empty">Nenhuma dívida cadastrada.</div>}
      </div>
    </div>

    <div className="stats" style={{marginTop:16}}>
      <div className="card"><div className="muted">A receber dos clientes</div><div className="stat-value">{money(summary.totalReceivable)}</div><div className="stat-meta">Saldo ainda aberto nas parcelas</div></div>
      <div className="card"><div className="muted">Empréstimos concedidos</div><div className="stat-value">{money(summary.loansGranted)}</div><div className="stat-meta">Desde {dateBR(summary.trackingStartDate)}</div></div>
      <div className="card"><div className="muted">Pagamentos que voltaram</div><div className="stat-value">{money(summary.paymentsReceived)}</div><div className="stat-meta">Desde {dateBR(summary.trackingStartDate)}</div></div>
      <div className="card"><div className="muted">Gastos extras</div><div className="stat-value">{money(summary.manualExpenses)}</div><div className="stat-meta">Inclui dívidas já pagas</div></div>
    </div>

    <div className="card" style={{marginTop:16}}>
      <div className="section-title"><div><h2>Extrato do Meu Caixa</h2><div className="muted" style={{fontSize:12}}>Empréstimos e pagamentos entram automaticamente. Entradas, gastos e dívidas pagas aparecem no mesmo extrato.</div></div><span className="badge gray">{movements.length}</span></div>
      <div className="list">
        {movements.length?movements.map(m=><div className="list-row cash-movement-row" key={`${m.source}-${m.id}`} style={{opacity:m.voided?.55:1}}>
          <div style={{minWidth:0,flex:1}}><strong>{m.title}</strong><div className="person-meta">{dateBR(m.date)} · {m.description}{m.source!=="manual"?" · automático":""}{m.voided?" · estornado":""}</div></div>
          <div className="movement-value"><strong className={m.amount>=0?"money-positive":"money-negative"}>{m.amount>=0?"+ ":"- "}{money(Math.abs(m.amount))}</strong>{m.source==="manual"&&!m.voided&&<button className="icon-btn" type="button" title="Estornar" disabled={pending} onClick={()=>undo(m.id)}><RotateCcw size={15}/></button>}</div>
        </div>):<div className="empty">Nenhuma movimentação a partir da data escolhida.</div>}
      </div>
    </div>
  </>;
}

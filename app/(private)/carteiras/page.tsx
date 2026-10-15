import { getActivePortfolio } from "@/lib/portfolio";
import { getLoans,getPayments,getInstallments,getLoanTopups,getDashboardSummary } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { money,realizedProfitForPayment } from "@/lib/finance";
import { brazilDateKey } from "@/lib/date";
import { registerPortfolioEntryAction,voidPortfolioEntryAction } from "@/app/portfolio-entry-actions";

type Entry={id:string;kind:"APORTE"|"CREDITO"|"AMORTIZACAO_DIVIDA"|"JUROS_FINANCIAMENTO"|"RETIRADA"|"DESPESA"|"PERDA"|"RECUPERACAO";amount:number;entry_date:string;description:string;loan_id:string|null;voided_at:string|null};
type Row={id:string;date:string;type:string;detail:string;amount:number;cashEffect:number;category:string;entryId?:string};
const cent=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;

export default async function WalletsPage(){
  const portfolioId=await getActivePortfolio();
  const supabase=await createClient();
  const [loans,payments,installments,topups,summary]=await Promise.all([
    getLoans(),getPayments(),getInstallments(),getLoanTopups(),getDashboardSummary()
  ]);
  let entries:Entry[]=[];
  if(supabase){
    const {data,error}=await supabase.from("portfolio_entries").select("*")
      .eq("portfolio_id",portfolioId).order("entry_date",{ascending:false});
    if(error)throw error;entries=(data||[]) as Entry[];
  }
  const activeEntries=entries.filter(e=>!e.voided_at);
  const loanMap=new Map(loans.map(l=>[l.id,l]));
  const topupsByLoan=new Map<string,number>();
  topups.forEach(t=>topupsByLoan.set(t.loan_id,(topupsByLoan.get(t.loan_id)||0)+Number(t.amount)));
  const funding=activeEntries.filter(e=>e.kind==="APORTE").reduce((s,e)=>s+Number(e.amount),0);
  const credit=activeEntries.filter(e=>e.kind==="CREDITO").reduce((s,e)=>s+Number(e.amount),0);
  const debtPrincipal=activeEntries.filter(e=>e.kind==="AMORTIZACAO_DIVIDA").reduce((s,e)=>s+Number(e.amount),0);
  const financeCost=activeEntries.filter(e=>e.kind==="JUROS_FINANCIAMENTO").reduce((s,e)=>s+Number(e.amount),0);
  const withdrawals=activeEntries.filter(e=>e.kind==="RETIRADA").reduce((s,e)=>s+Number(e.amount),0);
  const expenses=activeEntries.filter(e=>e.kind==="DESPESA").reduce((s,e)=>s+Number(e.amount),0);
  const writeoffs=activeEntries.filter(e=>e.kind==="PERDA").reduce((s,e)=>s+Number(e.amount),0);
  const recoveries=activeEntries.filter(e=>e.kind==="RECUPERACAO").reduce((s,e)=>s+Number(e.amount),0);
  const repayments=payments.reduce((s,p)=>s+Number(p.amount),0);
  const disbursements=loans.reduce((s,l)=>s+Number(l.principal_amount),0);
  const cashEstimate=cent(funding+credit-withdrawals-expenses-debtPrincipal-financeCost+repayments-disbursements);
  const realizedProfit=payments.reduce((s,p)=>s+realizedProfitForPayment(p,loanMap.get(p.loan_id)),0);
  const today=brazilDateKey();
  const delinquent=installments.filter(i=>i.due_date<today&&Number(i.remaining_amount)>0&&i.stored_status!=="CANCELADO");
  const overdue=delinquent.reduce((s,i)=>s+Number(i.remaining_amount),0);
  const exposure=summary.capitalCirculation;
  const month=today.slice(0,7);
  const months=Array.from(new Set([
    month,
    ...payments.map(p=>p.payment_date.slice(0,7)),
    ...activeEntries.map(e=>e.entry_date.slice(0,7))
  ])).sort().reverse();
  const monthStats=months.map(m=>{
    const received=payments.filter(p=>p.payment_date.startsWith(m));
    const spent=activeEntries.filter(e=>e.entry_date.startsWith(m));
    const interest=received.reduce((s,p)=>s+realizedProfitForPayment(p,loanMap.get(p.loan_id)),0);
    const costs=spent.filter(e=>e.kind==="DESPESA").reduce((s,e)=>s+Number(e.amount),0);
    const loss=spent.filter(e=>e.kind==="PERDA").reduce((s,e)=>s+Number(e.amount),0);
    const recovery=spent.filter(e=>e.kind==="RECUPERACAO").reduce((s,e)=>s+Number(e.amount),0);
    const financing=spent.filter(e=>e.kind==="JUROS_FINANCIAMENTO").reduce((s,e)=>s+Number(e.amount),0);
    return {month:m,received:received.reduce((s,p)=>s+Number(p.amount),0),interest,costs,financing,loss,recovery,net:interest-costs-financing-loss+recovery};
  });
  const rows:Row[]=[
    ...loans.map(l=>({
      id:"loan-"+l.id,date:l.start_date,type:"SAIDA",category:"Emprestimo",
      detail:"Empréstimo "+l.loan_code+" · "+(l.client?.name||"Cliente"),
      amount:Number(l.principal_amount)-(topupsByLoan.get(l.id)||0),
      cashEffect:-(Number(l.principal_amount)-(topupsByLoan.get(l.id)||0))
    })),
    ...topups.map(t=>({id:"topup-"+t.id,date:t.topup_date,type:"SAIDA",category:"Adicional",
      detail:"Capital adicional "+(t.loan?.loan_code||""),amount:Number(t.amount),cashEffect:-Number(t.amount)})),
    ...payments.map(p=>({id:"payment-"+p.id,date:p.payment_date,type:"ENTRADA",category:p.payment_kind==="JUROS"?"Juros":"Pagamento",
      detail:(p.client?.name||"Cliente")+" · "+(p.loan?.loan_code||""),
      amount:Number(p.amount),cashEffect:Number(p.amount)})),
    ...activeEntries.map(e=>{
      const cash=["APORTE","CREDITO"].includes(e.kind)?Number(e.amount):["RETIRADA","DESPESA","AMORTIZACAO_DIVIDA","JUROS_FINANCIAMENTO"].includes(e.kind)?-Number(e.amount):0;
      return {id:"entry-"+e.id,date:e.entry_date,type:cash>=0?"ENTRADA":"SAIDA",category:e.kind,
        detail:e.description,amount:Number(e.amount),cashEffect:cash,entryId:e.id};
    })
  ].sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
  const ageRanges=[{name:"1–7 dias",a:1,b:7},{name:"8–30 dias",a:8,b:30},{name:"31–60 dias",a:31,b:60},{name:"+60 dias",a:61,b:999999}];
  const lossByLoan=new Map<string,{client:string;lost:number;recovered:number}>();
  activeEntries.filter(e=>e.loan_id&&["PERDA","RECUPERACAO"].includes(e.kind)).forEach(e=>{
    const l=loanMap.get(e.loan_id!);
    const current=lossByLoan.get(e.loan_id!)||{client:l?.client?.name||"Cliente",lost:0,recovered:0};
    if(e.kind==="PERDA")current.lost+=Number(e.amount);else current.recovered+=Number(e.amount);
    lossByLoan.set(e.loan_id!,current);
  });
  const aged=ageRanges.map(x=>({...x,rows:delinquent.filter(i=>{
    const days=Math.floor((Date.parse(today+"T12:00:00Z")-Date.parse(i.due_date+"T12:00:00Z"))/86400000);
    return days>=x.a&&days<=x.b;
  })}));
  return <>
    <div className="page-head"><div><div className="eyebrow">Controle financeiro · Carteira {portfolioId}</div><h1>Carteira {portfolioId} · Conciliação</h1>
      <div className="muted">{portfolioId===1?"Operação antiga preservada; cadastros compartilhados com a Carteira 2.":"Operação nova, iniciada do zero. O saldo só aumenta quando houver aporte registrado."}</div></div></div>
    <div className="stats">
      <div className="card"><div className="muted">Capital próprio aportado</div><div className="stat-value">{money(funding)}</div></div>
      <div className="card"><div className="muted">Caixa calculado</div><div className="stat-value" style={{color:cashEstimate<0?"var(--red)":"inherit"}}>{portfolioId===1?"Não conciliado":money(cashEstimate)}</div><div className="person-meta">{portfolioId===1?"Histórico antigo sem caixa inicial conciliado. Não usar este campo como saldo disponível.":"Crédito + aportes + recebimentos - desembolsos e saídas"}</div></div>
      <div className="card"><div className="muted">Principal em circulação estimado</div><div className="stat-value">{money(exposure)}</div></div>
      <div className="card"><div className="muted">Crédito recebido</div><div className="stat-value">{money(credit)}</div></div>
      <div className="card"><div className="muted">Principal do financiamento pago</div><div className="stat-value">{money(debtPrincipal)}</div></div>
      <div className="card"><div className="muted">Recebido de clientes</div><div className="stat-value">{money(repayments)}</div></div>
      <div className="card"><div className="muted">Atrasado (ainda não é prejuízo)</div><div className="stat-value">{money(overdue)}</div></div>
      <div className="card"><div className="muted">Perda reconhecida, líquida</div><div className="stat-value">{money(writeoffs-recoveries)}</div></div>
    </div>
    <div className="grid-equal" style={{marginTop:16}}>
      <div className="card"><h2>Lançar movimento</h2><p className="muted">Separe capital próprio, crédito contratado, amortização da dívida e juros do financiamento. Perdas e reversões são contábeis: não geram caixa, que só entra por recebimentos ou aportes.</p>
        <form action={registerPortfolioEntryAction} className="form-grid">
          <div className="field"><label>Tipo</label><select className="select" name="kind" required>
            <option value="APORTE">Aporte de capital</option><option value="CREDITO">Entrada de dinheiro emprestado</option><option value="AMORTIZACAO_DIVIDA">Amortização do financiamento (principal)</option><option value="JUROS_FINANCIAMENTO">Juros / custo do financiamento</option><option value="RETIRADA">Retirada</option>
            <option value="DESPESA">Despesa</option><option value="PERDA">Perda reconhecida</option>
            <option value="RECUPERACAO">Reversão de perda</option>
          </select></div>
          <div className="field"><label>Valor (R$)</label><input className="input" name="amount" type="number" step="0.01" min="0.01" required/></div>
          <div className="field"><label>Data</label><input className="input" name="entry_date" type="date" defaultValue={today} required/></div>
          <div className="field full"><label>Descrição / origem / destino</label><input className="input" name="description" required placeholder="Ex.: aporte dos sócios, parcela do financiamento, despesa operacional"/></div>
          <div className="field"><label>Contrato vinculado (opcional)</label><select className="select" name="loan_id"><option value="">Não vincular</option>{loans.map(l=><option key={l.id} value={l.id}>{l.loan_code} · {l.client?.name}</option>)}</select></div>
          <div className="field"><button type="submit" className="btn">Registrar lançamento</button></div>
        </form>
      </div>
      <div className="card"><h2>Inadimplência por idade</h2><p className="muted">Atraso é recebível em aberto. Só vira perda reconhecida mediante baixa explícita.</p>
        <div className="list">{aged.map(x=><div className="list-row" key={x.name}><span>{x.name} · {x.rows.length} parcelas</span><strong>{money(x.rows.reduce((s,i)=>s+Number(i.remaining_amount),0))}</strong></div>)}</div>
        <div className="alert" style={{marginTop:16}}>Lucro estimado registrado: {money(realizedProfit)}. Despesas registradas: {money(expenses)}. Retiradas: {money(withdrawals)}. Nunca confundir previsão de juros com recebimento.</div>
      </div>
    </div>
    <div className="grid-equal" style={{marginTop:16}}>
      <div className="card"><h2>Clientes inadimplentes</h2>
        <p className="muted">Atrasos atuais, ainda recuperáveis. Valores contratuais incluem juros, não apenas principal.</p>
        <div className="list">{delinquent.slice().sort((a,b)=>Number(b.remaining_amount)-Number(a.remaining_amount)).slice(0,25).map(i=><div className="list-row" key={i.id}>
          <div><strong>{i.client?.name||"Cliente"}</strong><div className="person-meta">{i.loan?.loan_code} · vencimento {i.due_date}</div></div><strong>{money(i.remaining_amount)}</strong>
        </div>)}</div>
        {!delinquent.length&&<div className="empty">Nenhuma parcela em atraso nesta carteira.</div>}
      </div>
      <div className="card"><h2>Prejuízo reconhecido por contrato</h2>
        <p className="muted">Baixas explícitas com recuperação posterior registrada separadamente; não confundir com atrasos.</p>
        <div className="list">{Array.from(lossByLoan.entries()).map(([loanId,x])=><div className="list-row" key={loanId}>
          <div><strong>{x.client}</strong><div className="person-meta">{loanMap.get(loanId)?.loan_code||"Contrato"} · baixado {money(x.lost)} · revertido {money(x.recovered)}</div></div><strong>{money(x.lost-x.recovered)}</strong>
        </div>)}</div>
        {!lossByLoan.size&&<div className="empty">Nenhuma baixa de prejuízo registrada.</div>}
      </div>
    </div>
    <div className="card" style={{marginTop:16}}><h2>Resultado mensal por carteira</h2>
      <p className="muted">Juros recebidos estimados por rateio dos contratos. No pagamento somente de juros, o valor inteiro é juro. Aportes e retiradas não compõem o lucro.</p>
      <div className="table-wrap"><table><thead><tr><th>Mês</th><th>Recebimentos</th><th>Juros realizados (estim.)</th><th>Despesas</th><th>Custo do financiamento</th><th>Perdas</th><th>Recuperações</th><th>Resultado</th></tr></thead><tbody>{monthStats.map(x=><tr key={x.month}>
        <td>{x.month}</td><td>{money(x.received)}</td><td>{money(x.interest)}</td>
        <td>{money(x.costs)}</td><td>{money(x.financing)}</td><td>{money(x.loss)}</td><td>{money(x.recovery)}</td><td><strong>{money(x.net)}</strong></td>
      </tr>)}</tbody></table></div>
    </div>
    <div className="card" style={{marginTop:16}}><h2>Rastro de movimentações</h2><p className="muted">Sem apagar pagamentos ou empréstimos; lançamentos manuais podem ser estornados, permanecendo no histórico de auditoria.</p>
      <div className="table-wrap"><table><thead><tr><th>Data</th><th>Categoria</th><th>Descrição</th><th>Valor</th><th>Efeito no caixa</th><th></th></tr></thead><tbody>{rows.map(r=><tr key={r.id}>
        <td>{r.date}</td><td>{r.category}</td><td>{r.detail}</td><td>{money(r.amount)}</td>
        <td style={{color:r.cashEffect<0?"var(--red)":"var(--green)"}}>{r.cashEffect===0?"Contábil":(r.cashEffect>0?"+ ":"- ")+money(Math.abs(r.cashEffect))}</td>
        <td>{r.entryId?<form action={voidPortfolioEntryAction}><input type="hidden" name="entry_id" value={r.entryId}/><button className="btn secondary" type="submit">Estornar</button></form>:null}</td>
      </tr>)}</tbody></table></div>
      {!rows.length&&<div className="empty">Nenhum lançamento nesta carteira. Saldo inicial: R$ 0,00.</div>}
    </div>
  </>;
}

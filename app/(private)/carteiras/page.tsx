import { getActivePortfolio } from "@/lib/portfolio";
import { getLoans,getPayments,getInstallments,getLoanTopups,getDashboardSummary } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { money,realizedProfitForPayment } from "@/lib/finance";
import { brazilDateKey } from "@/lib/date";
import { registerPortfolioEntryAction,voidPortfolioEntryAction,registerOpeningBalanceAction } from "@/app/portfolio-entry-actions";
import { buildCashLedger } from "@/lib/cash-ledger";
import type { CashBaseline,PortfolioCashEntry } from "@/lib/cash-ledger";

export default async function WalletsPage(){
  const portfolioId=await getActivePortfolio();
  const supabase=await createClient();
  const [loans,payments,installments,topups,summary]=await Promise.all([
    getLoans(),getPayments(),getInstallments(),getLoanTopups(),getDashboardSummary()
  ]);
  let entries:PortfolioCashEntry[]=[];
  let baseline:CashBaseline|null=null;
  if(supabase){
    const {data,error}=await supabase.from("portfolio_entries").select("*")
      .eq("portfolio_id",portfolioId).order("entry_date",{ascending:false});
    if(error)throw error;entries=(data||[]) as PortfolioCashEntry[];
    const {data:starting,error:openingError}=await supabase.from("portfolio_cash_baselines")
      .select("portfolio_id,start_date,opening_balance,created_at").eq("portfolio_id",portfolioId).maybeSingle();
    if(openingError)throw openingError;
    baseline=starting as CashBaseline|null;
  }
  const activeEntries=entries.filter(e=>!e.voided_at);
  const ledger=buildCashLedger({loans,payments,topups,entries,baseline});
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
  const cashEstimate=ledger.balance;
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
  const rows=ledger.movements;
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
      <div className="muted">{portfolioId===1?"Operação antiga preservada; cadastros compartilhados com a Carteira 2.":"Operação nova, inicialmente zerada. Cada movimento real altera o saldo disponível."}</div></div></div>
    <div className="stats">
      <div className="card"><div className="muted">Capital próprio aportado</div><div className="stat-value">{money(funding)}</div></div>
      <div className="card"><div className="muted">Saldo disponível em caixa</div><div className="stat-value" style={{color:cashEstimate<0?"var(--red)":"inherit"}}>{portfolioId===1&&!baseline?"Não conciliado":money(cashEstimate)}</div><div className="person-meta">{portfolioId===1&&!baseline?"Registre o saldo real da data de abertura para iniciar a conciliação.":baseline?"Saldo de abertura + todas as entradas - todas as saídas desde "+baseline.start_date:"Carteira zerada: saldo inicial R$ 0,00 até lançar os primeiros valores."}</div></div>
      <div className="card"><div className="muted">Principal em circulação estimado</div><div className="stat-value">{money(exposure)}</div></div>
      <div className="card"><div className="muted">Crédito recebido</div><div className="stat-value">{money(credit)}</div></div>
      <div className="card"><div className="muted">Principal do financiamento pago</div><div className="stat-value">{money(debtPrincipal)}</div></div>
      <div className="card"><div className="muted">Recebido de clientes</div><div className="stat-value">{money(repayments)}</div></div>
      <div className="card"><div className="muted">Atrasado (ainda não é prejuízo)</div><div className="stat-value">{money(overdue)}</div></div>
      <div className="card"><div className="muted">Perda reconhecida, líquida</div><div className="stat-value">{money(writeoffs-recoveries)}</div></div>
    </div>
    <div className="card" style={{marginTop:16}}>
      <div className="section-title"><div><h2>Caixa real · Carteira {portfolioId}</h2><div className="muted">O empréstimo que você cadastra sai automaticamente do caixa. Ao registrar o pagamento, o valor recebido entra automaticamente.</div></div></div>
      <div className="stats" style={{marginTop:12}}>
        <div className="card"><div className="muted">Saldo de abertura</div><div className="stat-value">{money(ledger.openingBalance)}</div></div>
        <div className="card"><div className="muted">Entradas após abertura</div><div className="stat-value" style={{color:"var(--green)"}}>{money(ledger.received)}</div></div>
        <div className="card"><div className="muted">Saídas após abertura</div><div className="stat-value" style={{color:"var(--red)"}}>{money(ledger.spent)}</div></div>
        <div className="card"><div className="muted">Disponível agora</div><div className="stat-value" style={{color:ledger.balance<0?"var(--red)":"var(--green)"}}>{portfolioId===1&&!baseline?"Não conciliado":money(ledger.balance)}</div></div>
      </div>
      {baseline
        ? <div className="alert" style={{marginTop:12}}>Abertura registrada em {baseline.start_date}, com saldo de {money(baseline.opening_balance)} no início desse dia. Movimentos anteriores continuam no histórico, mas não entram no saldo atual.</div>
        : <div className="grid-equal" style={{marginTop:12}}>
            <div><h2>Definir caixa inicial</h2><p className="muted">Digite o dinheiro que havia disponível no <strong>início da data escolhida</strong>. Por exemplo, R$ 115.000,00, se já for o saldo após a quitação de dívidas antigas.</p>
              <form action={registerOpeningBalanceAction} className="form-grid">
                <div className="field"><label>Saldo inicial (R$)</label><input className="input" name="opening_balance" type="number" min="0" step="0.01" placeholder="115000.00" required/></div>
                <div className="field"><label>Data de referência</label><input className="input" name="start_date" type="date" defaultValue={today} required/></div>
                <div className="field full"><label>Observação</label><input className="input" name="notes" placeholder="Ex.: saldo após quitar obrigações anteriores"/></div>
                <div className="field full"><button className="btn" type="submit">Registrar saldo de abertura</button></div>
              </form>
            </div>
            <div className="alert">Escolha <strong>uma forma de começar</strong>: cadastrar um saldo inicial líquido ou lançar separadamente capital próprio, empréstimo bancário e pagamentos de dívidas. Não faça as duas coisas para os mesmos valores. Se você já iniciou as movimentações, use como abertura o saldo no começo do dia indicado.</div>
          </div>}
    </div>
    <div className="grid-equal" style={{marginTop:16}}>
      <div className="card"><h2>Lançar movimento</h2><p className="muted">Registre pagamentos das dívidas e gastos aqui. Para parcelas de financiamento, separe principal em “Pagamento de dívida” e juros em “Juros de financiamento”. Não lance manualmente recebimentos dos clientes: eles já entram quando você registra o pagamento.</p>
        <form action={registerPortfolioEntryAction} className="form-grid">
          <div className="field"><label>Tipo</label><select className="select" name="kind" required>
            <option value="APORTE">Aporte de capital</option><option value="CREDITO">Entrada de dinheiro emprestado</option><option value="AMORTIZACAO_DIVIDA">Pagamento / quitação de dívida (principal)</option><option value="JUROS_FINANCIAMENTO">Juros / custo do financiamento</option><option value="RETIRADA">Retirada dos sócios</option>
            <option value="DESPESA">Despesa geral</option><option value="OUTRA_ENTRADA">Outra entrada (não é pagamento de cliente)</option><option value="OUTRA_SAIDA">Outra saída</option><option value="PERDA">Perda reconhecida</option>
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
    <div className="card" style={{marginTop:16}}>
      <h2>Extrato do caixa: saldo após cada movimento</h2>
      <p className="muted">Mostra a origem de cada entrada e o destino de cada saída, com valores em centavos e saldo atualizado. Empréstimos e recebimentos são automáticos; gastos e dívidas são lançados acima. {baseline?"Data de início do controle: "+baseline.start_date:"Antes do saldo de abertura, o histórico da Carteira 1 não é conciliado."}</p>
      <div className="table-wrap"><table><thead><tr><th>Data</th><th>Movimentação</th><th>Descrição</th><th>Entrada</th><th>Saída</th><th>Saldo após</th><th>Ação</th></tr></thead>
        <tbody>{rows.map(r=><tr key={r.id}>
          <td>{r.date}</td><td>{r.category}</td><td>{r.description}</td>
          <td style={{color:"var(--green)"}}>{r.direction==="ENTRADA"?"+"+money(r.amount):"·"}</td>
          <td style={{color:"var(--red)"}}>{r.direction==="SAIDA"?"-"+money(r.amount):"·"}</td>
          <td><strong style={{color:r.balanceAfter<0?"var(--red)":"inherit"}}>{portfolioId===1&&!baseline?"Não conciliado":money(r.balanceAfter)}</strong></td>
          <td>{r.entryId?<form action={voidPortfolioEntryAction}><input type="hidden" name="entry_id" value={r.entryId}/><button type="submit" className="btn secondary">Estornar</button></form>:null}</td>
        </tr>)}</tbody>
      </table></div>
      {!rows.length&&<div className="empty">Nenhuma entrada ou saída registrada após a abertura.</div>}
      {entries.some(e=>e.voided_at)&&<div className="alert" style={{marginTop:12}}>{entries.filter(e=>e.voided_at).length} lançamento(s) manual(is) estornado(s), preservado(s) no banco, não somados ao saldo.</div>}
    </div>
  </>;
}

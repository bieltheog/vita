import test from "node:test";
import assert from "node:assert/strict";
import { buildCashLedger } from "../lib/cash-ledger.ts";

const date="2026-10-15";
function loan(id,principal,dateValue=date){
  return {id,client_id:"test",client:{name:"Cliente de teste"},loan_code:id,
    principal_amount:principal,start_date:dateValue,created_at:dateValue+"T08:00:00Z",status:"ATIVO"};
}
function payment(id,loan_id,value){
  return {id,loan_id,amount:value,payment_date:date,created_at:date+"T12:00:00Z",
    client:{name:"Cliente de teste"},loan:{loan_code:loan_id},payment_kind:"NORMAL"};
}
function entry(id,kind,value,voided_at=null){
  return {id,portfolio_id:2,kind,amount:value,entry_date:date,
    created_at:date+"T16:00:00Z",description:kind,loan_id:null,voided_at};
}
function ledger(options={}){
  return buildCashLedger({loans:[],payments:[],topups:[],entries:[],baseline:null,...options});
}
test("Caixa inicia zerado e não cria movimentações fictícias",()=>{
  const c=ledger();
  assert.equal(c.balance,0);
  assert.equal(c.movements.length,0);
  assert.equal(c.reconciled,false);
});
test("115 mil: sai 500, entra 700, dívida 2500 e gasto 200",()=>{
  const c=ledger({
    baseline:{portfolio_id:2,start_date:date,opening_balance:115000,created_at:date+"T00:00:00Z"},
    loans:[loan("EMP-1",500)],
    payments:[payment("P1","EMP-1",700)],
    entries:[entry("D1","AMORTIZACAO_DIVIDA",2500),entry("G1","DESPESA",200)]
  });
  assert.equal(c.balance,112500);
  assert.equal(c.received,700);
  assert.equal(c.spent,3200);
  assert.equal(c.movements.length,4);
  assert.equal(c.movements[0].balanceAfter,112500);
  assert.ok(c.movements.find(x=>x.id==="loan:EMP-1" && x.delta===-500));
  assert.ok(c.movements.find(x=>x.id==="payment:P1" && x.delta===700));
});
test("Juros-only não debita principal outra vez na renovação",()=>{
  const c=ledger({loans:[loan("L1",1000)],
    payments:[{...payment("J1","L1",400),payment_kind:"JUROS"},payment("P2","L1",1400)]});
  assert.equal(c.balance,800);
  assert.equal(c.movements.filter(x=>x.source==="loan").length,1);
});
test("Adicional de capital não é deduzido em duplicidade",()=>{
  const topup={id:"T1",loan_id:"L1",amount:300,topup_date:date,
    created_at:date+"T10:00:00Z",loan:{loan_code:"L1"}};
  const c=ledger({baseline:{portfolio_id:2,start_date:date,opening_balance:2000},
    loans:[loan("L1",1300)],topups:[topup]});
  assert.equal(c.balance,700);
  assert.equal(c.movements.find(x=>x.id==="loan:L1").delta,-1000);
  assert.equal(c.movements.find(x=>x.id==="topup:T1").delta,-300);
});
test("Estorno e perdas apenas contábeis não afetam caixa",()=>{
  const c=ledger({entries:[
    entry("D1","DESPESA",10,"2026-10-16T10:00:00Z"),
    entry("L1","PERDA",500),entry("R1","RECUPERACAO",300),
    entry("X1","OUTRA_ENTRADA",25),entry("X2","OUTRA_SAIDA",5)
  ]});
  assert.equal(c.balance,20);
  assert.equal(c.movements.length,2);
});
test("Saldo de abertura ignora eventos anteriores sem apagar histórico",()=>{
  const c=ledger({baseline:{portfolio_id:1,start_date:date,opening_balance:115000},
    loans:[loan("L-ANTIGO",250,"2026-10-14")],
    payments:[payment("P-NOVO","L-ANTIGO",300)]});
  assert.equal(c.balance,115300);
});
test("Conserva precisão de centavos ao somar entradas e saídas",()=>{
  const c=ledger({entries:[
    entry("1","APORTE",0.01),entry("2","APORTE",0.02),
    entry("3","DESPESA",0.01)
  ]});
  assert.equal(c.balance,0.02);
});

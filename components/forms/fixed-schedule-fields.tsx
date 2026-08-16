"use client";

import type { FixedScheduleRule } from "@/lib/types";

type RuleState = FixedScheduleRule | { type: "NONE"; value: number };

export function FixedScheduleFields({
  first,
  second,
  onFirstChange,
  onSecondChange,
}: {
  first: RuleState;
  second: RuleState;
  onFirstChange: (rule: RuleState) => void;
  onSecondChange: (rule: RuleState) => void;
}) {
  const ruleInput = (
    prefix: "fixed_rule_1" | "fixed_rule_2",
    rule: RuleState,
    onChange: (rule: RuleState) => void,
    optional = false,
  ) => {
    const isBusiness = rule.type === "BUSINESS_DAY";
    return <div className="card" style={{background:"#090c11",padding:12}}>
      <div className="muted" style={{fontSize:11,marginBottom:8}}>{optional ? "Regra 2 (opcional)" : "Regra 1"}</div>
      <div className="form-grid" style={{gap:8}}>
        <div className="field">
          <label>Tipo</label>
          <select
            className="select"
            name={`${prefix}_type`}
            value={rule.type}
            onChange={e=>{
              const type=e.target.value as RuleState["type"];
              onChange({type,value:type==="BUSINESS_DAY"?5:15} as RuleState);
            }}
          >
            {optional&&<option value="NONE">Não usar</option>}
            <option value="DAY_OF_MONTH">Dia do mês</option>
            <option value="BUSINESS_DAY">Nº dia útil do mês</option>
          </select>
        </div>
        {rule.type!=="NONE"&&<div className="field">
          <label>{isBusiness?"Qual dia útil?":"Qual dia?"}</label>
          <input
            className="input"
            name={`${prefix}_value`}
            type="number"
            min="1"
            max={isBusiness?23:31}
            value={rule.value}
            onChange={e=>onChange({...rule,value:Math.max(1,Number(e.target.value)||1)} as RuleState)}
            required={!optional}
          />
        </div>}
      </div>
    </div>;
  };

  return <div className="field full">
    <label>Regras das datas fixas</label>
    <div className="grid-equal">
      {ruleInput("fixed_rule_1",first,onFirstChange)}
      {ruleInput("fixed_rule_2",second,onSecondChange,true)}
    </div>
    <div className="muted" style={{fontSize:11,marginTop:7}}>
      Ex.: dia 15 + dia 30, ou dia 20 + 5º dia útil. As regras se repetem mês a mês até completar o número de parcelas.
    </div>
  </div>;
}

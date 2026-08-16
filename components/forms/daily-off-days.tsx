"use client";

const WEEK_DAYS = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

export function DailyOffDays({ selected, onChange }: { selected: number[]; onChange: (days: number[]) => void }) {
  function toggle(day: number) {
    onChange(selected.includes(day) ? selected.filter(item => item !== day) : [...selected, day].sort((a,b)=>a-b));
  }

  return <div className="field full">
    <label>Dias sem cobrança da diária</label>
    <div className="muted" style={{fontSize:12,marginBottom:8}}>Marque os dias da semana em que o cliente não precisa pagar. Essas datas serão puladas no calendário.</div>
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
      {WEEK_DAYS.map(day=><label key={day.value} className={`btn ${selected.includes(day.value)?"":"secondary"}`} style={{padding:"8px 11px",cursor:"pointer"}}>
        <input type="checkbox" name="daily_off_days" value={day.value} checked={selected.includes(day.value)} onChange={()=>toggle(day.value)} style={{marginRight:6}}/>
        {day.label}
      </label>)}
    </div>
    {selected.length===0&&<div className="muted" style={{fontSize:11,marginTop:8}}>Nenhum dia de folga: haverá cobrança todos os dias.</div>}
  </div>;
}

"use client";
import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { createClientAction } from "@/app/actions";

export function ClientForm({ demo = false, defaultOpen = false }: { demo?: boolean; defaultOpen?: boolean }) {
  const [open,setOpen] = useState(defaultOpen); const [pending,start] = useTransition(); const [error,setError] = useState("");
  async function submit(formData: FormData) { setError(""); start(async()=>{ try { await createClientAction(formData); setOpen(false); } catch(e){ setError(e instanceof Error ? e.message : "Erro ao cadastrar cliente."); } }); }
  return <>
    <button className="btn" onClick={()=>setOpen(true)}><Plus size={16}/> Novo Cliente</button>
    {open && <div className="modal-backdrop"><div className="modal">
      <div className="section-title"><div><h2>Novo cliente</h2><div className="muted text-sm">Cadastre os dados principais.</div></div><button className="icon-btn" onClick={()=>setOpen(false)}><X size={17}/></button></div>
      {demo && <div className="alert">Modo demonstração: configure o Supabase para salvar novos clientes.</div>}
      <form action={submit} className="form-grid form-gap">
        <div className="field full"><label>Nome completo *</label><input className="input" name="name" required/></div>
        <div className="field"><label>CPF</label><input className="input" name="cpf"/></div><div className="field"><label>Telefone</label><input className="input" name="phone"/></div>
        <div className="field"><label>WhatsApp</label><input className="input" name="whatsapp"/></div><div className="field"><label>E-mail</label><input className="input" type="email" name="email"/></div>
        <div className="field"><label>Data de nascimento</label><input className="input" type="date" name="birth_date"/></div><div className="field"><label>Profissão</label><input className="input" name="profession"/></div>
        <div className="field full"><label>Endereço</label><input className="input" name="address"/></div>
        <div className="field"><label>Cidade</label><input className="input" name="city"/></div><div className="field"><label>Estado</label><input className="input" name="state" maxLength={2}/></div>
        <div className="field"><label>CEP</label><input className="input" name="zipcode"/></div><div className="field"><label>Observações</label><input className="input" name="notes"/></div>
        {error && <div className="field full"><div className="alert">{error}</div></div>}
        <div className="field full form-actions"><button type="button" className="btn secondary" onClick={()=>setOpen(false)}>Cancelar</button><button className="btn" disabled={pending || demo}>{pending ? "Salvando..." : "Cadastrar cliente"}</button></div>
      </form>
    </div></div>}
  </>;
}

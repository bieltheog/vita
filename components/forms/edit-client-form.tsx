"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { updateClientAction } from "@/app/actions";
import type { Client } from "@/lib/types";

export function EditClientForm({ client }: { client: Client }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();

  async function submit(formData: FormData) {
    setError("");
    start(async () => {
      try {
        await updateClientAction(formData);
        setOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao atualizar cliente.");
      }
    });
  }

  return <>
    <button className="btn secondary" onClick={() => setOpen(true)}><Pencil size={16}/> Editar cliente</button>
    {open && <div className="modal-backdrop"><div className="modal">
      <div className="section-title"><div><h2>Editar cliente</h2><div className="muted" style={{fontSize:12}}>Atualize apenas os dados cadastrais. O histórico financeiro será preservado.</div></div><button className="icon-btn" onClick={() => setOpen(false)}><X size={17}/></button></div>
      <form action={submit} className="form-grid" style={{marginTop:14}}>
        <input type="hidden" name="client_id" value={client.id}/>
        <div className="field full"><label>Nome completo *</label><input className="input" name="name" required defaultValue={client.name}/></div>
        <div className="field"><label>CPF</label><input className="input" name="cpf" defaultValue={client.cpf || ""}/></div>
        <div className="field"><label>Telefone</label><input className="input" name="phone" defaultValue={client.phone || ""}/></div>
        <div className="field"><label>WhatsApp</label><input className="input" name="whatsapp" defaultValue={client.whatsapp || ""}/></div>
        <div className="field"><label>E-mail</label><input className="input" type="email" name="email" defaultValue={client.email || ""}/></div>
        <div className="field"><label>Data de nascimento</label><input className="input" type="date" name="birth_date" defaultValue={client.birth_date || ""}/></div>
        <div className="field"><label>Profissão</label><input className="input" name="profession" defaultValue={client.profession || ""}/></div>
        <div className="field full"><label>Endereço</label><input className="input" name="address" defaultValue={client.address || ""}/></div>
        <div className="field"><label>Cidade</label><input className="input" name="city" defaultValue={client.city || ""}/></div>
        <div className="field"><label>Estado</label><input className="input" name="state" maxLength={2} defaultValue={client.state || ""}/></div>
        <div className="field"><label>CEP</label><input className="input" name="zipcode" defaultValue={client.zipcode || ""}/></div>
        <div className="field"><label>Observações</label><input className="input" name="notes" defaultValue={client.notes || ""}/></div>
        {error && <div className="field full"><div className="alert">{error}</div></div>}
        <div className="field full" style={{flexDirection:"row",justifyContent:"flex-end"}}><button type="button" className="btn secondary" onClick={() => setOpen(false)}>Cancelar</button><button className="btn" disabled={pending}>{pending ? "Salvando..." : "Salvar alterações"}</button></div>
      </form>
    </div></div>}
  </>;
}

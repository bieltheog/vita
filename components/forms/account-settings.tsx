"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function ChangePasswordForm({ demo = false }: { demo?: boolean }) {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const password = String(form.get("password") || "");
    const confirm = String(form.get("confirm") || "");
    setError(""); setMessage("");
    if (password.length < 8) { setError("A senha precisa ter pelo menos 8 caracteres."); return; }
    if (password !== confirm) { setError("As senhas não são iguais."); return; }
    setLoading(true);
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) throw error;
      formEl.reset();
      setMessage("Senha alterada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível alterar a senha.");
    } finally {
      setLoading(false);
    }
  }

  return <form onSubmit={submit} className="form-grid">
    <div className="field"><label htmlFor="settings-password">Nova senha</label><input id="settings-password" className="input" type="password" name="password" autoComplete="new-password" minLength={8} required disabled={demo} /></div>
    <div className="field"><label htmlFor="settings-confirm">Repita a nova senha</label><input id="settings-confirm" className="input" type="password" name="confirm" autoComplete="new-password" minLength={8} required disabled={demo} /></div>
    {error && <div className="field full"><div className="alert alert-error">{error}</div></div>}
    {message && <div className="field full"><div className="alert alert-success">{message}</div></div>}
    <div className="field full form-actions"><button className="btn" disabled={loading || demo}>{loading ? "Salvando..." : "Alterar senha"}</button></div>
  </form>;
}

export function LogoutButton({ demo = false }: { demo?: boolean }) {
  const router = useRouter();
  async function logout() {
    if (!demo) { try { await createClient().auth.signOut(); } catch {} }
    router.push("/login");
    router.refresh();
  }
  return <button type="button" className="btn danger" onClick={logout}><LogOut size={16} /> Sair da conta</button>;
}

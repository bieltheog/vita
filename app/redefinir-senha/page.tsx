"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type State = "checking" | "ready" | "invalid" | "done";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [state, setState] = useState<State>("checking");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    let supabase: ReturnType<typeof createClient>;
    try { supabase = createClient(); } catch { setState("invalid"); return; }
    // O cliente do navegador troca o código do link por uma sessão ao carregar.
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) setState("ready");
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setState(current => current === "checking" ? (data.session ? "ready" : "invalid") : current);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") || "");
    const confirm = String(form.get("confirm") || "");
    setError("");
    if (password.length < 8) { setError("A senha precisa ter pelo menos 8 caracteres."); return; }
    if (password !== confirm) { setError("As senhas não são iguais."); return; }
    setLoading(true);
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) throw error;
      setState("done");
      setTimeout(() => { router.push("/dashboard"); router.refresh(); }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar a nova senha.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="auth-page">
    <div className="auth-card">
      <div className="auth-brand"><div className="brand-mark">J</div><div className="brand-name">Jureminha</div></div>
      <h1>Nova senha</h1>
      {state === "checking" && <p className="muted auth-sub">Verificando o link...</p>}
      {state === "invalid" && <>
        <div className="alert alert-error form-gap">Este link é inválido ou expirou. Peça um novo link na tela de login, de preferência abrindo no mesmo aparelho em que você pediu.</div>
        <Link className="btn secondary btn-block form-gap" href="/login">Voltar para o login</Link>
      </>}
      {state === "done" && <div className="alert alert-success form-gap">Senha alterada. Entrando...</div>}
      {state === "ready" && <form onSubmit={submit}>
        <p className="muted auth-sub">Escolha uma nova senha com pelo menos 8 caracteres.</p>
        <div className="field"><label htmlFor="new-password">Nova senha</label><input id="new-password" className="input" type="password" name="password" autoComplete="new-password" minLength={8} required /></div>
        <div className="field form-gap"><label htmlFor="confirm-password">Repita a nova senha</label><input id="confirm-password" className="input" type="password" name="confirm" autoComplete="new-password" minLength={8} required /></div>
        {error && <div className="alert alert-error form-gap">{error}</div>}
        <button className="btn btn-block form-gap" disabled={loading}>{loading ? "Salvando..." : "Salvar nova senha"}</button>
      </form>}
    </div>
  </main>;
}

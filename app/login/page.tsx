"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const demoEnabled = !(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
);

function friendlyError(message: string) {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (m.includes("rate limit") || m.includes("too many")) return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  return message;
}

export default function LoginPage() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [resetSent, setResetSent] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: String(form.get("email")),
        password: String(form.get("password")),
      });
      if (error) throw error;
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "Falha no login"));
    } finally {
      setLoading(false);
    }
  }

  async function requestReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(String(form.get("email")), {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      if (error) throw error;
      setResetSent(true);
    } catch (err) {
      setError(friendlyError(err instanceof Error ? err.message : "Não foi possível enviar o e-mail."));
    } finally {
      setLoading(false);
    }
  }

  function switchMode(next: "login" | "reset") {
    setMode(next);
    setError("");
    setResetSent(false);
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark">J</div>
          <div className="brand-name">Jureminha</div>
        </div>

        {mode === "login" ? (
          <form onSubmit={submit}>
            <h1>Entrar</h1>
            <p className="muted auth-sub">Clientes, empréstimos e cobranças em um só lugar.</p>

            <div className="field">
              <label htmlFor="login-email">E-mail</label>
              <input id="login-email" className="input" type="email" name="email" autoComplete="email" placeholder="seuemail@email.com" required />
            </div>

            <div className="field form-gap">
              <label htmlFor="login-password">Senha</label>
              <div className="password-field">
                <input id="login-password" className="input" type={show ? "text" : "password"} name="password" autoComplete="current-password" required />
                <button type="button" onClick={() => setShow(!show)} className="icon-btn" aria-label={show ? "Esconder senha" : "Mostrar senha"}>
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="button" className="link-btn auth-forgot" onClick={() => switchMode("reset")}>Esqueci minha senha</button>

            {error && <div className="alert alert-error form-gap">{error}</div>}

            <button className="btn btn-block form-gap" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </button>

            {demoEnabled && (
              <>
                <button type="button" className="btn secondary btn-block list-top" onClick={() => router.push("/dashboard")}>
                  Visualizar demonstração
                </button>
                <div className="demo-pill">O botão de demonstração permite visualizar a interface sem gravar dados.</div>
              </>
            )}
          </form>
        ) : (
          <form onSubmit={requestReset}>
            <h1>Recuperar senha</h1>
            {resetSent ? (
              <>
                <div className="alert alert-success form-gap">Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha. Confira também a caixa de spam.</div>
                <button type="button" className="btn secondary btn-block form-gap" onClick={() => switchMode("login")}>Voltar para o login</button>
              </>
            ) : (
              <>
                <p className="muted auth-sub">Informe seu e-mail e enviaremos um link para criar uma nova senha.</p>
                <div className="field">
                  <label htmlFor="reset-email">E-mail</label>
                  <input id="reset-email" className="input" type="email" name="email" autoComplete="email" required />
                </div>
                {error && <div className="alert alert-error form-gap">{error}</div>}
                <button className="btn btn-block form-gap" disabled={loading || demoEnabled}>{loading ? "Enviando..." : "Enviar link"}</button>
                <button type="button" className="link-btn auth-back" onClick={() => switchMode("login")}>Voltar para o login</button>
              </>
            )}
          </form>
        )}
      </div>
    </main>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const demoEnabled = !(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
);

export default function LoginPage() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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
      setError(err instanceof Error ? err.message : "Falha no login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-art">
        <div className="brand">
          <div className="brand-mark">J</div>
          <div>
            <div className="brand-name">Jureminha 2.0</div>
            <div className="brand-sub">Controle financeiro premium</div>
          </div>
        </div>
        <div className="login-copy">
          <div className="eyebrow">Gestão financeira pessoal</div>
          <h1>Seu dinheiro.<br />Seus clientes.<br />Tudo sob controle.</h1>
          <p>Clientes, empréstimos, parcelas, recebimentos e atrasos em uma única central.</p>
        </div>
        <div className="muted" style={{ fontSize: 12 }}>
          Dados protegidos por autenticação e Row Level Security.
        </div>
      </section>

      <section className="login-panel">
        <form className="login-form" onSubmit={submit}>
          <div className="login-logo">
            <div className="stat-icon"><LockKeyhole size={18} /></div>
            <h1 style={{ marginTop: 18 }}>Entrar no Jureminha 2.0</h1>
            <p className="muted">Acesse sua central financeira.</p>
          </div>

          <div className="field">
            <label>E-mail</label>
            <input className="input" type="email" name="email" placeholder="seuemail@email.com" required />
          </div>

          <div className="field" style={{ marginTop: 14 }}>
            <label>Senha</label>
            <div style={{ position: "relative" }}>
              <input
                className="input"
                type={show ? "text" : "password"}
                name="password"
                required
                style={{ paddingRight: 46 }}
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                style={{ position: "absolute", right: 7, top: 6 }}
                className="icon-btn"
              >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && <div className="alert" style={{ marginTop: 14 }}>{error}</div>}

          <button className="btn" style={{ width: "100%", marginTop: 18 }} disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>

          {demoEnabled && (
            <>
              <button
                type="button"
                className="btn secondary"
                style={{ width: "100%", marginTop: 9 }}
                onClick={() => router.push("/dashboard")}
              >
                Visualizar demonstração
              </button>
              <div className="demo-pill">
                O botão de demonstração permite visualizar a interface sem gravar dados.
              </div>
            </>
          )}
        </form>
      </section>
    </main>
  );
}

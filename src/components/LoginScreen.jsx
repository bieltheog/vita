import { useState } from "react";
import { supabase } from "../supabase";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function handleLogin(e) {
    e.preventDefault();

    setLoading(true);
    setError("");
    setInfo("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("E-mail ou senha incorretos. Verifique e tente novamente.");
    }

    setLoading(false);
  }

  async function handleMagicLink() {
    setLoading(true);
    setError("");
    setInfo("");

    if (!email.trim()) {
      setError("Digite seu e-mail para receber o link de acesso.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
    });

    if (error) {
      setError("Não foi possível enviar o link de acesso.");
    } else {
      setInfo("Link de acesso enviado para seu e-mail.");
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#0b0d11] text-white">
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8">
        <div className="pointer-events-none absolute right-[-160px] top-[-160px] h-[420px] w-[420px] rounded-full bg-orange-500/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-180px] left-[-180px] h-[420px] w-[420px] rounded-full bg-amber-500/10 blur-3xl" />

        <div className="relative grid w-full max-w-[1120px] grid-cols-1 overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#11151b]/95 shadow-2xl backdrop-blur xl:grid-cols-[1.05fr_0.95fr]">
          <div className="hidden min-h-[640px] flex-col justify-between border-r border-white/[0.08] bg-gradient-to-br from-[#171b22] to-[#0d1016] p-10 xl:flex">
            <div>
              <div className="mb-10 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500 text-xl font-bold text-white">
                  J
                </div>

                <div>
                  <h1 className="text-xl font-bold text-white">
                    Jure<span className="text-orange-400">minha</span>
                  </h1>
                  <p className="text-xs text-slate-500">
                    Gestão de Recebimentos
                  </p>
                </div>
              </div>

              <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-300">
                Painel financeiro
              </p>

              <h2 className="mt-4 max-w-xl text-4xl font-bold leading-tight text-white">
                Controle seus clientes, parcelas e recebimentos em um só lugar.
              </h2>

              <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-400">
                Acompanhe empréstimos, atrasos, histórico, fichas de clientes e
                cobranças com uma interface simples, rápida e organizada.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-5">
                <p className="text-xs text-slate-500">Controle</p>
                <p className="mt-2 text-2xl font-bold text-orange-300">
                  Parcelas
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5">
                <p className="text-xs text-slate-500">Gestão</p>
                <p className="mt-2 text-2xl font-bold text-emerald-300">
                  Clientes
                </p>
              </div>

              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-5">
                <p className="text-xs text-slate-500">Alertas</p>
                <p className="mt-2 text-2xl font-bold text-rose-300">
                  Atrasos
                </p>
              </div>

              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5">
                <p className="text-xs text-slate-500">Histórico</p>
                <p className="mt-2 text-2xl font-bold text-amber-300">
                  Lucro
                </p>
              </div>
            </div>
          </div>

          <div className="flex min-h-screen items-center justify-center p-5 sm:p-8 xl:min-h-[640px] xl:p-10">
            <div className="w-full max-w-md">
              <div className="mb-8 flex items-center gap-3 xl:hidden">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500 text-lg font-bold text-white">
                  J
                </div>

                <div>
                  <h1 className="text-lg font-bold text-white">
                    Jure<span className="text-orange-400">minha</span>
                  </h1>
                  <p className="text-xs text-slate-500">
                    Gestão de Recebimentos
                  </p>
                </div>
              </div>

              <div className="mb-8">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-300">
                  Acesso seguro
                </p>

                <h2 className="mt-3 text-3xl font-bold text-white">
                  Entrar na conta
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  Faça login para acessar o painel da Jureminha.
                </p>
              </div>

              {error && (
                <div className="mb-4 rounded-xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-200">
                  {error}
                </div>
              )}

              {info && (
                <div className="mb-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                  {info}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-slate-300">
                    E-mail
                  </span>

                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    autoComplete="email"
                    placeholder="seu@email.com"
                    className="input-dark w-full rounded-xl px-4 py-3 text-sm outline-none"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-slate-300">
                    Senha
                  </span>

                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    autoComplete="current-password"
                    placeholder="Digite sua senha"
                    className="input-dark w-full rounded-xl px-4 py-3 text-sm outline-none"
                  />
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-orange-600 disabled:opacity-60"
                >
                  {loading ? "Entrando..." : "Entrar"}
                </button>
              </form>

              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/[0.08]" />
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                  ou
                </span>
                <div className="h-px flex-1 bg-white/[0.08]" />
              </div>

              <button
                type="button"
                onClick={handleMagicLink}
                disabled={loading}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-5 py-3 text-sm font-bold text-slate-300 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-60"
              >
                Enviar link de acesso por e-mail
              </button>

              <p className="mt-6 text-center text-xs leading-relaxed text-slate-600">
                Acesso restrito ao administrador. Mantenha sua senha em
                segurança.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
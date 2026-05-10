export function StatCard({ title, value, icon, subtitle, tone = "purple" }) {
  const tones = {
    purple: "from-purple-600/25 to-fuchsia-600/10 text-purple-200",
    cyan: "from-cyan-500/25 to-blue-600/10 text-cyan-200",
    green: "from-emerald-500/25 to-green-600/10 text-emerald-200",
    red: "from-rose-500/25 to-red-600/10 text-rose-200",
    orange: "from-orange-500/25 to-yellow-600/10 text-orange-200",
  };

  return (
    <div className="group relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#11162a]/80 p-4 shadow-xl backdrop-blur-xl transition hover:-translate-y-1 hover:border-purple-400/40 hover:shadow-purple-950/40 md:p-5">
      <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-purple-500/10 blur-3xl transition group-hover:bg-purple-500/20" />

      <div className="relative flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-zinc-400 md:text-sm">
            {title}
          </p>

          <h3 className="mt-2 break-words text-xl font-black tracking-tight text-white md:text-2xl">
            {value}
          </h3>

          {subtitle && (
            <p className="mt-2 text-xs text-zinc-500">{subtitle}</p>
          )}
        </div>

        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${
            tones[tone] || tones.purple
          } border border-white/10 text-2xl shadow-lg`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

export function StatusBadge({ status }) {
  const classes = {
    Ativo: "bg-cyan-500/15 border-cyan-400/30 text-cyan-100",
    Recebido: "bg-emerald-500/15 border-emerald-400/30 text-emerald-100",
    Atrasado: "bg-rose-500/15 border-rose-400/30 text-rose-100",
    Quitado: "bg-emerald-500/15 border-emerald-400/30 text-emerald-100",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
        classes[status] || classes.Ativo
      }`}
    >
      {status}
    </span>
  );
}

export function TabButton({ active, onClick, children, icon, badge }) {
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold transition ${
        active
          ? "border-purple-400/40 bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-lg shadow-purple-950/40"
          : "border-white/10 bg-white/[0.04] text-zinc-300 hover:border-purple-400/40 hover:bg-white/[0.07] hover:text-white"
      }`}
    >
      {icon && <span className="text-lg">{icon}</span>}
      <span>{children}</span>
      {badge !== undefined && Number(badge) > 0 && (
        <span className="ml-auto rounded-full bg-rose-500/20 px-2 py-0.5 text-xs text-rose-200">
          {badge}
        </span>
      )}
    </button>
  );
}

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-zinc-300">
        {label}
      </span>
      {children}
    </label>
  );
}

export function Section({ title, description, children }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-[#11162a]/80 p-4 shadow-xl backdrop-blur-xl md:p-5">
      <div className="mb-4">
        <h3 className="text-lg font-black text-white">{title}</h3>

        {description && (
          <p className="mt-1 text-sm text-zinc-400">{description}</p>
        )}
      </div>

      {children}
    </div>
  );
}

export function inputClass() {
  return "w-full rounded-2xl border border-white/10 bg-[#080c1d] px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-purple-400/60 focus:ring-4 focus:ring-purple-500/10 md:text-base";
}

export function PremiumCard({ children, className = "" }) {
  return (
    <div
      className={`rounded-[1.7rem] border border-white/10 bg-[#11162a]/80 p-4 shadow-xl backdrop-blur-xl md:p-5 ${className}`}
    >
      {children}
    </div>
  );
}
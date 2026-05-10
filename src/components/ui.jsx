export function StatCard({ title, value, icon, subtitle }) {
  return (
    <div className="premium-glass premium-card-hover rounded-[1.6rem] text-white overflow-hidden relative">
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-cyan-400/10 blur-2xl" />
      <div className="absolute -bottom-10 left-8 h-24 w-24 rounded-full bg-purple-500/10 blur-2xl" />

      <div className="relative p-4 md:p-5 flex items-center justify-between gap-3 md:gap-4">
        <div className="min-w-0">
          <p className="text-xs md:text-sm text-cyan-100/70">{title}</p>

          <h3 className="text-xl md:text-2xl font-black mt-1 break-words tracking-tight">
            {value}
          </h3>

          {subtitle && (
            <p className="text-xs text-zinc-400 mt-1">{subtitle}</p>
          )}
        </div>

        <div className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-gradient-to-br from-cyan-400/25 to-purple-600/25 border border-white/10 text-cyan-100 flex items-center justify-center text-xl md:text-2xl shrink-0 shadow-lg">
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
    Atrasado: "bg-red-500/15 border-red-400/30 text-red-100",
    Quitado: "bg-emerald-500/15 border-emerald-400/30 text-emerald-100",
  };

  return (
    <span
      className={`px-3 py-1 rounded-full text-xs border ${
        classes[status] || classes.Ativo
      }`}
    >
      {status}
    </span>
  );
}

export function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-4 py-3 rounded-2xl text-sm font-bold transition border ${
        active
          ? "bg-gradient-to-r from-cyan-400 to-purple-600 text-white border-white/20 shadow-lg shadow-purple-950/40"
          : "bg-white/[0.04] text-zinc-300 border-white/10 hover:text-white hover:border-cyan-400/40 hover:bg-white/[0.07]"
      }`}
    >
      {children}
    </button>
  );
}

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-sm text-cyan-100/70 mb-1 block">{label}</span>
      {children}
    </label>
  );
}

export function Section({ title, description, children }) {
  return (
    <div className="premium-glass rounded-[1.6rem] p-4 md:p-5 space-y-4">
      <div>
        <h3 className="text-base md:text-lg font-black">{title}</h3>

        {description && (
          <p className="text-sm text-zinc-400 mt-1">{description}</p>
        )}
      </div>

      {children}
    </div>
  );
}

export function inputClass() {
  return "premium-input w-full rounded-xl px-4 py-3 outline-none text-sm md:text-base";
}
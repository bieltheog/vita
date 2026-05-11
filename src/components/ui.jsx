export function StatCard({ title, value, icon, subtitle, tone = "purple" }) {
  const tones = {
    purple: "border-purple-500/20 bg-purple-500/10 text-purple-300",
    pink: "border-pink-500/20 bg-pink-500/10 text-pink-300",
    green: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    orange: "border-orange-500/20 bg-orange-500/10 text-orange-300",
    cyan: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
    red: "border-rose-500/20 bg-rose-500/10 text-rose-300",
  };

  return (
    <div className="app-card card-hover rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-400">{title}</p>

          <h3 className="mt-2 break-words text-xl font-bold text-white">
            {value}
          </h3>

          {subtitle && (
            <p className="mt-2 text-xs font-medium text-slate-500">
              {subtitle}
            </p>
          )}
        </div>

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-base ${
            tones[tone] || tones.purple
          }`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

export function StatusBadge({ status }) {
  const classes = {
    Ativo: "bg-cyan-500/10 border-cyan-500/25 text-cyan-300",
    Recebido: "bg-emerald-500/10 border-emerald-500/25 text-emerald-300",
    Atrasado: "bg-rose-500/10 border-rose-500/25 text-rose-300",
    Quitado: "bg-emerald-500/10 border-emerald-500/25 text-emerald-300",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
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
      className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
        active
          ? "bg-purple-600 text-white shadow-lg shadow-purple-950/30"
          : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
      }`}
    >
      {icon && <span className="text-base">{icon}</span>}
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
      <span className="mb-1 block text-sm font-medium text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}

export function Section({ title, description, children }) {
  return (
    <div className="app-card rounded-2xl p-4">
      <div className="mb-4">
        <h3 className="text-base font-bold text-white">{title}</h3>

        {description && (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        )}
      </div>

      {children}
    </div>
  );
}

export function inputClass() {
  return "input-dark w-full rounded-xl px-3.5 py-3 text-sm outline-none placeholder:text-slate-600";
}

export function PremiumCard({ children, className = "" }) {
  return (
    <div className={`app-card rounded-2xl p-4 ${className}`}>
      {children}
    </div>
  );
}

export function SmallButton({ children, onClick, type = "button", variant = "default" }) {
  const variants = {
    default:
      "border border-white/[0.08] bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white",
    purple: "bg-purple-600 text-white hover:bg-purple-700",
    green: "bg-emerald-600 text-white hover:bg-emerald-700",
    red: "bg-rose-600 text-white hover:bg-rose-700",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${
        variants[variant] || variants.default
      }`}
    >
      {children}
    </button>
  );
}
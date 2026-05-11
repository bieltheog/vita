export function StatCard({ title, value, icon, subtitle, tone = "purple" }) {
  const tones = {
    purple: "geex-purple",
    pink: "geex-pink",
    cyan: "geex-cyan",
    green: "geex-green",
    orange: "geex-orange",
  };

  return (
    <div className="geex-soft-card geex-hover rounded-[1.6rem] p-4 md:p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-400 md:text-sm">
            {title}
          </p>

          <h3 className="mt-2 break-words text-xl font-black tracking-tight text-slate-900 md:text-2xl">
            {value}
          </h3>

          {subtitle && (
            <p className="mt-2 text-xs font-medium text-emerald-500">
              {subtitle}
            </p>
          )}
        </div>

        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
            tones[tone] || tones.purple
          } text-xl text-white shadow-lg`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

export function StatusBadge({ status }) {
  const classes = {
    Ativo: "bg-cyan-50 border-cyan-200 text-cyan-700",
    Recebido: "bg-emerald-50 border-emerald-200 text-emerald-700",
    Atrasado: "bg-rose-50 border-rose-200 text-rose-700",
    Quitado: "bg-emerald-50 border-emerald-200 text-emerald-700",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${
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
      className={`flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition ${
        active
          ? "geex-purple text-white shadow-lg shadow-purple-200"
          : "bg-white text-slate-500 hover:bg-purple-50 hover:text-purple-700"
      }`}
    >
      {icon && <span className="text-lg">{icon}</span>}
      <span>{children}</span>

      {badge !== undefined && Number(badge) > 0 && (
        <span className="ml-auto rounded-full bg-rose-500 px-2 py-0.5 text-xs text-white">
          {badge}
        </span>
      )}
    </button>
  );
}

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

export function Section({ title, description, children }) {
  return (
    <div className="geex-card rounded-[1.7rem] p-4 md:p-5">
      <div className="mb-4">
        <h3 className="text-lg font-black text-slate-900">{title}</h3>

        {description && (
          <p className="mt-1 text-sm text-slate-400">{description}</p>
        )}
      </div>

      {children}
    </div>
  );
}

export function inputClass() {
  return "geex-input w-full rounded-2xl px-4 py-3 text-sm outline-none placeholder:text-slate-300 md:text-base";
}

export function PremiumCard({ children, className = "" }) {
  return (
    <div className={`geex-card rounded-[1.7rem] p-4 md:p-5 ${className}`}>
      {children}
    </div>
  );
}
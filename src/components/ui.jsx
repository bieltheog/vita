export function StatCard({ title, value, icon, subtitle }) {
  return (
    <div className="rounded-2xl shadow-sm border border-zinc-800 bg-zinc-950 text-white">
      <div className="p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-400">{title}</p>
          <h3 className="text-2xl font-bold mt-1">{value}</h3>
          {subtitle && <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>}
        </div>

        <div className="w-12 h-12 rounded-2xl bg-purple-600/20 text-purple-300 flex items-center justify-center text-2xl">
          {icon}
        </div>
      </div>
    </div>
  );
}

export function StatusBadge({ status }) {
  const classes = {
    Ativo: "bg-purple-600/20 border-purple-500/30 text-purple-200",
    Recebido: "bg-emerald-600/20 border-emerald-500/30 text-emerald-200",
    Atrasado: "bg-red-600/20 border-red-500/30 text-red-200",
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs border ${classes[status] || classes.Ativo}`}>
      {status}
    </span>
  );
}

export function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 rounded-xl text-sm font-semibold transition ${
        active
          ? "bg-purple-600 text-white"
          : "bg-zinc-950 text-zinc-400 border border-zinc-800 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-sm text-zinc-400 mb-1 block">{label}</span>
      {children}
    </label>
  );
}

export function Section({ title, description, children }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-black/30 p-5 space-y-4">
      <div>
        <h3 className="text-lg font-bold">{title}</h3>
        {description && <p className="text-sm text-zinc-500 mt-1">{description}</p>}
      </div>

      {children}
    </div>
  );
}

export function inputClass() {
  return "w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 outline-none focus:border-purple-500";
}
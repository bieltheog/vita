import Link from "next/link";

const tabs = [
  { href: "/relatorios", label: "Visão geral" },
  { href: "/carteiras/relatorio", label: "Relatório do caixa" },
  { href: "/carteiras/detalhes", label: "Inadimplência e resultado" },
] as const;

/** Abas que juntam os relatórios espalhados em uma única seção. */
export function ReportTabs({ active }: { active: (typeof tabs)[number]["href"] }) {
  return <nav className="report-tabs" aria-label="Relatórios">
    {tabs.map(tab => <Link key={tab.href} href={tab.href} className={`report-tab ${tab.href === active ? "active" : ""}`} aria-current={tab.href === active ? "page" : undefined}>{tab.label}</Link>)}
  </nav>;
}

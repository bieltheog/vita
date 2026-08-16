"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, Landmark, CreditCard, CalendarDays, BarChart3,
  Calculator, Bell, Settings, Search, LogOut, MoreHorizontal, Plus, WalletCards,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/emprestimos", label: "Empréstimos", icon: Landmark },
  { href: "/pagamentos", label: "Pagamentos", icon: CreditCard },
  { href: "/calendario", label: "Calendário", icon: CalendarDays },
  { href: "/fluxo-caixa", label: "Fluxo de Caixa", icon: WalletCards },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/simulador", label: "Simulador", icon: Calculator },
  { href: "/notificacoes", label: "Notificações", icon: Bell },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

const mobile = [
  { href: "/dashboard", label: "Início", icon: LayoutDashboard },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/calendario", label: "Calendário", icon: CalendarDays },
  { href: "/pagamentos", label: "Pagamentos", icon: CreditCard },
  { href: "/configuracoes", label: "Mais", icon: MoreHorizontal },
];

export function AppShell({ children, profile }: { children: React.ReactNode; profile: { full_name?: string | null; email?: string | null; demo?: boolean } }) {
  const pathname = usePathname();
  const router = useRouter();
  const active = (href: string) => pathname === href || pathname.startsWith(href + "/");

  async function logout() {
    if (profile.demo) { router.push("/login"); return; }
    try { await createClient().auth.signOut(); } catch {}
    router.push("/login");
    router.refresh();
  }

  return <div className="shell">
    <aside className="sidebar">
      <Link className="brand" href="/dashboard">
        <div className="brand-mark">J</div>
        <div><div className="brand-name">Jureminha 2.0</div><div className="brand-sub">Controle financeiro premium</div></div>
      </Link>
      <nav className="nav">
        {nav.map(({href,label,icon:Icon}) => <Link key={href} href={href} className={`nav-link ${active(href) ? "active" : ""}`}><Icon size={17}/>{label}</Link>)}
      </nav>
      <div className="sidebar-footer">
        <div className="person" style={{padding:"8px"}}>
          <div className="avatar">{(profile.full_name || "U")[0]?.toUpperCase()}</div>
          <div style={{minWidth:0,flex:1}}><div className="person-name">{profile.full_name || "Usuário"}</div><div className="person-meta">{profile.demo ? "Modo demonstração" : profile.email}</div></div>
          <button className="icon-btn" onClick={logout} title="Sair"><LogOut size={16}/></button>
        </div>
      </div>
    </aside>

    <main className="main">
      <header className="topbar">
        <div className="search-box"><Search size={17}/><input aria-label="Busca global" placeholder="Buscar cliente, CPF ou empréstimo..." /></div>
        <div className="top-actions">
          {profile.demo && <span className="badge blue">Demo</span>}
          <Link className="icon-btn" href="/notificacoes"><Bell size={17}/></Link>
          <Link className="icon-btn" href="/configuracoes"><Settings size={17}/></Link>
        </div>
      </header>
      {children}
    </main>

    <Link className="fab" href="/emprestimos?novo=1" aria-label="Novo"><Plus size={24}/></Link>
    <nav className="mobile-nav">
      {mobile.map(({href,label,icon:Icon}) => <Link key={href} href={href} className={active(href) ? "active" : ""}><Icon size={19}/><span>{label}</span></Link>)}
    </nav>
  </div>;
}

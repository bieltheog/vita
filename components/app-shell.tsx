"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Users, Landmark, CreditCard, CalendarDays, BarChart3,
  Calculator, Bell, Settings, Search, LogOut, MoreHorizontal, Plus, WalletCards,
  CircleDollarSign, CheckCircle2, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cobrancas-hoje", label: "Cobranças", icon: CircleDollarSign },
  { href: "/fechamento-diario", label: "Fechamento diário", icon: CheckCircle2 },
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
  { href: "/cobrancas-hoje", label: "Cobrar", icon: CircleDollarSign },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/calendario", label: "Calendário", icon: CalendarDays },
];

const mobileMore = [
  { href: "/emprestimos", label: "Empréstimos", icon: Landmark },
  { href: "/pagamentos", label: "Pagamentos", icon: CreditCard },
  { href: "/fechamento-diario", label: "Fechamento diário", icon: CheckCircle2 },
  { href: "/fluxo-caixa", label: "Fluxo de Caixa", icon: WalletCards },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { href: "/simulador", label: "Simulador", icon: Calculator },
  { href: "/notificacoes", label: "Notificações", icon: Bell },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export function AppShell({ children, profile }: { children: React.ReactNode; profile: { full_name?: string | null; email?: string | null; demo?: boolean } }) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen,setMoreOpen]=useState(false);
  const active = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const moreActive=mobileMore.some(item=>active(item.href));

  async function logout() {
    if (profile.demo) { router.push("/login"); return; }
    try { await createClient().auth.signOut(); } catch {}
    router.push("/login");
    router.refresh();
  }

  function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const q=String(form.get("q")||"").trim();
    if(q) router.push(`/clientes?q=${encodeURIComponent(q)}`);
  }

  return <div className="shell">
    <aside className="sidebar">
      <Link className="brand" href="/dashboard">
        <div className="brand-mark">J</div>
        <div><div className="brand-name">Jureminha 2.0</div><div className="brand-sub">Empréstimos e cobranças</div></div>
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
        <form className="search-box" onSubmit={search}><Search size={17}/><input name="q" aria-label="Busca global" placeholder="Buscar cliente..." /></form>
        <div className="top-actions">
          {profile.demo && <span className="badge blue">Demo</span>}
          <Link className="icon-btn" href="/notificacoes"><Bell size={17}/></Link>
          <Link className="icon-btn desktop-settings" href="/configuracoes"><Settings size={17}/></Link>
        </div>
      </header>
      {children}
    </main>

    <Link className="fab" href="/emprestimos?novo=1" aria-label="Novo empréstimo"><Plus size={24}/></Link>
    <nav className="mobile-nav">
      {mobile.map(({href,label,icon:Icon}) => <Link key={href} href={href} className={active(href) ? "active" : ""}><Icon size={19}/><span>{label}</span></Link>)}
      <button type="button" className={moreActive||moreOpen?"active":""} onClick={()=>setMoreOpen(true)}><MoreHorizontal size={19}/><span>Mais</span></button>
    </nav>

    {moreOpen&&<div className="mobile-more-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setMoreOpen(false)}}>
      <div className="mobile-more-sheet">
        <div className="mobile-more-head"><div><strong>Mais opções</strong><div className="person-meta">Acesso rápido às outras áreas</div></div><button className="icon-btn" type="button" onClick={()=>setMoreOpen(false)}><X size={17}/></button></div>
        <div className="mobile-more-grid">
          {mobileMore.map(({href,label,icon:Icon})=><Link key={href} href={href} onClick={()=>setMoreOpen(false)} className={active(href)?"active":""}><span className="mobile-more-icon"><Icon size={20}/></span><span>{label}</span></Link>)}
        </div>
        <button type="button" className="mobile-logout" onClick={logout}><LogOut size={18}/> Sair da conta</button>
      </div>
    </div>}
  </div>;
}

import { getCurrentProfile } from "@/lib/data";
import { ChangePasswordForm, LogoutButton } from "@/components/forms/account-settings";

export default async function SettingsPage() {
  const profile = await getCurrentProfile();
  const demo = Boolean(profile?.demo);
  return <>
    <div className="page-head"><div><h1>Configurações</h1><div className="muted">Sua conta e acesso.</div></div></div>
    <div className="grid-equal">
      <div className="card">
        <div className="section-title"><h2>Conta</h2></div>
        <div className="person">
          <div className="avatar">{(profile?.full_name || "U")[0]?.toUpperCase()}</div>
          <div><div className="person-name">{profile?.full_name || "Usuário"}</div><div className="person-meta">{demo ? "Modo demonstração" : profile?.email}</div></div>
        </div>
        <div className="divider" />
        <LogoutButton demo={demo} />
      </div>
      <div className="card">
        <div className="section-title"><div><h2>Alterar senha</h2><div className="muted text-sm">Use pelo menos 8 caracteres.</div></div></div>
        <ChangePasswordForm demo={demo} />
      </div>
    </div>
  </>;
}

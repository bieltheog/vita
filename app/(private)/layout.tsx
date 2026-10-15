import { AppShell } from "@/components/app-shell";
import { getCurrentProfile } from "@/lib/data";
import { redirect } from "next/navigation";
import { getActivePortfolio } from "@/lib/portfolio";

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const [profile,portfolioId] = await Promise.all([getCurrentProfile(),getActivePortfolio()]);
  if (!profile) redirect("/login");
  return <AppShell profile={profile} portfolioId={portfolioId}><div className="content">{children}</div></AppShell>;
}

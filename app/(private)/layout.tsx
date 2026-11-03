import { AppShell } from "@/components/app-shell";
import { getCurrentProfile, getInstallments } from "@/lib/data";
import { brazilDateKey } from "@/lib/date";
import { redirect } from "next/navigation";
import { getActivePortfolio } from "@/lib/portfolio";

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const [profile,portfolioId,installments] = await Promise.all([getCurrentProfile(),getActivePortfolio(),getInstallments()]);
  if (!profile) redirect("/login");
  const today = brazilDateKey();
  const overdueCount = installments.filter(row => row.stored_status !== "CANCELADO" && Number(row.remaining_amount) > 0 && row.due_date < today).length;
  return <AppShell profile={profile} portfolioId={portfolioId} overdueCount={overdueCount}><div className="content">{children}</div></AppShell>;
}

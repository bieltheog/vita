import { AppShell } from "@/components/app-shell";
import { getCurrentProfile } from "@/lib/data";
import { redirect } from "next/navigation";

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return <AppShell profile={profile}><div className="content">{children}</div></AppShell>;
}

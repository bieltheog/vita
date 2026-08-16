import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function StatCard({ label, value, meta, icon: Icon, href }: { label: string; value: string; meta?: string; icon: LucideIcon; href?: string }) {
  const content = <div className="card card-click"><div className="stat-label"><span>{label}</span><span className="stat-icon"><Icon size={17}/></span></div><div className="stat-value">{value}</div>{meta && <div className="stat-meta">{meta}</div>}</div>;
  return href ? <Link href={href}>{content}</Link> : content;
}

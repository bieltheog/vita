import Link from "next/link";

type Props = {
  title: string;
  text?: string;
  action?: { href: string; label: string };
};

/** Estado vazio com uma orientação do próximo passo. */
export function EmptyState({ title, text, action }: Props) {
  return <div className="empty-state">
    <strong>{title}</strong>
    {text && <span>{text}</span>}
    {action && <Link className="btn secondary" href={action.href}>{action.label}</Link>}
  </div>;
}

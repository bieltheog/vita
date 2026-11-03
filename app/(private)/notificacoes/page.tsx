import { redirect } from "next/navigation";

// Os atrasados ficam na tela de Cobranças.
export default function NotificationsPage() {
  redirect("/cobrancas-hoje?filtro=atrasados");
}

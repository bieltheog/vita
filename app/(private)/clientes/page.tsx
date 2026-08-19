import { getClients,getLoans,getPayments,getInstallments,getCurrentProfile } from "@/lib/data";
import { ClientForm } from "@/components/forms/client-form";
import { ClientList } from "@/components/collections/client-list";

export default async function Clients({searchParams}:{searchParams:Promise<{q?:string}>}){
  const params=await searchParams;
  const [clients,loans,payments,installments,profile]=await Promise.all([getClients(),getLoans(),getPayments(),getInstallments(),getCurrentProfile()]);
  return <><div className="page-head"><div><div className="eyebrow">Cadastro</div><h1>Clientes</h1><div className="muted">Gerencie histórico, empréstimos, saldo e situação de cada cliente.</div></div><ClientForm demo={profile?.demo}/></div><ClientList clients={clients} loans={loans} payments={payments} installments={installments} initialQuery={params.q||""}/></>
}

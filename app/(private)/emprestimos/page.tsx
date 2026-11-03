import {getLoans,getClients,getCurrentProfile,getInstallments} from '@/lib/data';
import {LoanForm} from '@/components/forms/loan-form';
import {LoanList} from '@/components/collections/loan-list';

export default async function LoansPage({searchParams}:{searchParams:Promise<{novo?:string}>}){
  const params=await searchParams;
  const[loans,clients,profile,installments]=await Promise.all([getLoans(),getClients(),getCurrentProfile(),getInstallments({includeInactive:true})]);
  return <><div className="page-head"><div><div className="eyebrow">Carteira</div><h1>Empréstimos</h1><div className="muted">Pesquise, filtre, edite e acompanhe o histórico de cada operação.</div></div><LoanForm clients={clients} demo={profile?.demo} defaultOpen={params.novo==="1"}/></div><LoanList loans={loans} installments={installments}/></>
}

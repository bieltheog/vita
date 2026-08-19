import {getLoans,getClients,getCurrentProfile,getInstallments} from '@/lib/data';
import {LoanForm} from '@/components/forms/loan-form';
import {LoanList} from '@/components/collections/loan-list';

export default async function LoansPage(){
  const[loans,clients,profile,installments]=await Promise.all([getLoans(),getClients(),getCurrentProfile(),getInstallments()]);
  return <><div className="page-head"><div><div className="eyebrow">Carteira</div><h1>Empréstimos</h1><div className="muted">Pesquise, filtre, edite e acompanhe o histórico de cada operação.</div></div><LoanForm clients={clients} demo={profile?.demo}/></div><LoanList loans={loans} installments={installments}/></>
}

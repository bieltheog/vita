import { redirect } from "next/navigation";

// O formulário de novo empréstimo já calcula lucro e parcelas antes de salvar.
export default function SimulatorPage() {
  redirect("/emprestimos?novo=1");
}

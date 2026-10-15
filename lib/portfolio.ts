import { cookies } from "next/headers";

/** Carteira 1 contém todos os lançamentos legados. Carteira 2 inicia sem lançamentos. */
export type PortfolioId = 1 | 2;
export async function getActivePortfolio(): Promise<PortfolioId> {
  const store = await cookies();
  return store.get("jureminha_portfolio")?.value === "2" ? 2 : 1;
}

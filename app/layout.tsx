import type { Metadata } from "next";
import "./globals.css";
import "./premium.css";
import "./mobile.css";
import "./mobile-premium.css";
import "./topup.css";
import "./collections.css";
import "./print.css";

export const metadata: Metadata = {
  title: "Jureminha 2.0",
  description: "Seu dinheiro. Seus clientes. Tudo sob controle.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}

import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { logout } from "./login/actions";
import { BarraArea } from "@/components/BarraArea";
import { EstadoDatos } from "@/components/EstadoDatos";
import { pendienteActual } from "@/lib/er/datos";

const montserrat = Montserrat({ subsets: ["latin"], weight: ["200", "400", "600", "700", "800", "900"], variable: "--font-montserrat" });

export const metadata: Metadata = {
  title: "Yourebrand · Plataforma",
  description: "Plataforma interna de operaciones de Yourebrand",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Se calcula en el servidor en cada carga: no depende de que alguien entre a Finanzas.
  const pendiente = await pendienteActual();
  return (
    <html lang="es">
      <body className={`${montserrat.variable} antialiased`}>
        <BarraArea
          pendiente={!!pendiente}
          extra={
            <>
              <EstadoDatos />
              <form action={logout}>
                <button className="text-xs text-zinc-400 hover:text-accent">Salir</button>
              </form>
            </>
          }
        />
        <main className="px-4 py-6 md:px-10 md:py-8">{children}</main>
      </body>
    </html>
  );
}

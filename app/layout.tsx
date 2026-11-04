import type { Metadata } from "next";
import Link from "next/link";
import { Montserrat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({ subsets: ["latin"], weight: ["200", "400", "600", "700", "800", "900"], variable: "--font-montserrat" });

export const metadata: Metadata = {
  title: "Yourebrand · Plataforma",
  description: "Plataforma interna de operaciones de Yourebrand",
};

const areas = [
  { nombre: "Dirección", items: [{ href: "/clientes", label: "Clientes" }] },
  { nombre: "RRHH", items: [{ href: "/rrhh/organigrama", label: "Organigrama" }] },
  { nombre: "Creativa", items: [] },
  { nombre: "Operaciones", items: [] },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${montserrat.variable} antialiased`}>
        <div className="flex min-h-screen flex-col md:flex-row">
          <aside className="border-b border-zinc-200 bg-white px-5 py-4 md:w-56 md:border-b-0 md:border-r md:py-6">
            <Link href="/" className="block leading-none">
              <span className="text-xl font-black tracking-tight">Yourebrand<span className="text-accent">.</span></span>
              <span className="mt-1 block text-[10px] font-extralight text-ink/70">Agencia Full service de marketing digital.</span>
            </Link>
            <nav className="mt-4 flex gap-6 overflow-x-auto md:mt-8 md:flex-col md:gap-5">
              {areas.map((a) => (
                <div key={a.nombre} className="shrink-0">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">{a.nombre}</p>
                  {a.items.length ? (
                    a.items.map((i) => (
                      <Link key={i.href} href={i.href} className="mt-1 block text-sm font-semibold text-black hover:text-accent">
                        {i.label}
                      </Link>
                    ))
                  ) : (
                    <p className="mt-1 text-sm text-zinc-300">Próximamente</p>
                  )}
                </div>
              ))}
            </nav>
          </aside>
          <main className="flex-1 px-4 py-6 md:px-10 md:py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}

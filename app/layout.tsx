import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yourebrand · Plataforma",
  description: "Plataforma interna de operaciones de Yourebrand",
};

const areas = [
  { nombre: "Dirección", items: [{ href: "/clientes", label: "Clientes" }] },
  { nombre: "RRHH", items: [] },
  { nombre: "Creativa", items: [] },
  { nombre: "Operaciones", items: [] },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased">
        <div className="flex min-h-screen flex-col md:flex-row">
          <aside className="border-b border-zinc-200 bg-white px-5 py-4 md:w-56 md:border-b-0 md:border-r md:py-6">
            <Link href="/" className="text-lg font-semibold tracking-tight">Yourebrand</Link>
            <nav className="mt-4 flex gap-6 overflow-x-auto md:mt-8 md:flex-col md:gap-5">
              {areas.map((a) => (
                <div key={a.nombre} className="shrink-0">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">{a.nombre}</p>
                  {a.items.length ? (
                    a.items.map((i) => (
                      <Link key={i.href} href={i.href} className="mt-1 block text-sm font-medium text-zinc-800 hover:text-black">
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

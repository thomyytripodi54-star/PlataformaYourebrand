import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/Logo";
import { formatFecha, formatPago } from "@/lib/clientes";
import { getDatos } from "@/lib/datos";

export const revalidate = 60;

export default async function FichaCliente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = (await getDatos()).clientes.find((x) => x.id === id);
  if (!c) notFound();

  const datos: [string, React.ReactNode][] = [
    ["Contacto", c.contacto ?? "—"],
    ["Email", c.email ?? "—"],
    ["Teléfono", c.telefono ?? "—"],
    ["País", c.pais ?? "—"],
    ["Segmento", c.segmento ?? "—"],
    ["Rubro", c.rubros.join(", ") || "—"],
    ["Cliente desde", formatFecha(c.desde)],
    ["Vencimiento", formatFecha(c.vencimiento)],
    ["Pago mensual", formatPago(c.pagoMensual)],
  ];
  const links = [
    c.instagram && { label: `@${c.instagram}`, href: `https://www.instagram.com/${c.instagram}/` },
    c.web && { label: "Sitio web", href: c.web },
    c.linkedin && { label: "LinkedIn", href: c.linkedin },
    { label: "Ver en Notion", href: c.notionUrl },
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/clientes" className="text-sm text-zinc-500 hover:text-zinc-800">← Clientes</Link>
      <header className="mt-4 flex items-center gap-4">
        <Logo cliente={c} size={72} />
        <div>
          <h1 className="text-2xl font-black tracking-tight">{c.nombre}<span className="text-accent">.</span></h1>
          <span className="mt-1 inline-block rounded-full bg-ink px-2 py-0.5 text-xs font-semibold text-white">{c.estado}</span>
        </div>
      </header>

      <div className="mt-4 flex flex-wrap gap-2">
        {links.map((l) => (
          <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:border-zinc-400">
            {l.label}
          </a>
        ))}
      </div>

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold">Planes contratados</h2>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {c.planes.map((p) => (
            <span key={p} className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-700">{p}</span>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold">Datos</h2>
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {datos.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-zinc-400">{k}</dt>
              <dd className="text-sm break-words">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

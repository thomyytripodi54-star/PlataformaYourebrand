import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarioCliente } from "@/components/CalendarioCliente";
import { Logo } from "@/components/Logo";
import { formatFecha, formatPago } from "@/lib/clientes";
import { getCalendario, getDatos } from "@/lib/datos";

export const revalidate = 60;

// Planes que no llevan calendario de contenido (p. ej. Gorrion: solo desarrollo web).
const PLANES_SIN_CONTENIDO = new Set(["Web", "Plan google", "SEO y Articulos"]);

function Lista({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="space-y-2">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-[11px] text-zinc-400">{k}</dt>
          <dd className="break-words text-sm">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function FichaCliente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = (await getDatos()).clientes.find((x) => x.id === id);
  if (!c) notFound();
  const sinContenido = c.planes.length > 0 && c.planes.every((p) => PLANES_SIN_CONTENIDO.has(p));
  const cal = sinContenido ? null : await getCalendario(c.notionUrl);

  const contacto: [string, React.ReactNode][] = [
    ["Contacto", c.contacto ?? "—"],
    ["Email", c.email ?? "—"],
    ["Teléfono", c.telefono ?? "—"],
  ];
  const contrato: [string, React.ReactNode][] = [
    ["Cliente desde", formatFecha(c.desde)],
    ["Vencimiento", formatFecha(c.vencimiento)],
    ["Pago mensual", formatPago(c.pagoMensual)],
    ["País · Segmento", `${c.pais ?? "—"} · ${c.segmento ?? "—"}`],
  ];
  const links = [
    c.instagram && { label: `@${c.instagram}`, href: `https://www.instagram.com/${c.instagram}/` },
    c.web && { label: "Sitio web", href: c.web },
    c.linkedin && { label: "LinkedIn", href: c.linkedin },
    { label: "Ver en Notion", href: c.notionUrl },
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <div className="mx-auto max-w-7xl">
      <Link href="/clientes/dashboard" className="text-sm text-zinc-500 hover:text-ink">
        ← Dashboard de clientes
      </Link>

      <header className="mt-4 flex flex-wrap items-center gap-4">
        <Logo cliente={c} size={72} />
        <div className="min-w-0">
          <h1 className="text-3xl font-black tracking-tight">
            {c.nombre}
            <span className="text-accent">.</span>
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">{c.rubros.join(" · ") || "—"}</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          {links.map((l) => (
            <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold hover:border-ink">
              {l.label}
            </a>
          ))}
        </div>
      </header>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <section className="rounded-2xl border border-zinc-200 bg-white p-4">
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Planes contratados</h2>
          <div className="flex flex-wrap gap-1.5">
            {c.planes.map((p) => (
              <span key={p} className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold">
                {p}
              </span>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border border-zinc-200 bg-white p-4">
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Contacto</h2>
          <Lista items={contacto} />
        </section>
        <section className="rounded-2xl border border-zinc-200 bg-white p-4">
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Contrato</h2>
          <Lista items={contrato} />
        </section>
      </div>

      <section className="mt-6 rounded-3xl border border-zinc-200 bg-white p-4 md:p-6">
        <h2 className="mb-4 text-xl font-black uppercase tracking-tight">
          Calendario de contenido<span className="text-accent">.</span>
        </h2>
        {sinContenido ? (
          <p className="rounded-2xl bg-surface p-6 text-center text-sm text-zinc-500">
            Este cliente tiene contratado <b className="text-ink">{c.planes.join(", ")}</b>, sin gestión de contenido: no lleva calendario.
          </p>
        ) : cal?.motivo ? (
          <p className="rounded-2xl bg-accent-soft/60 p-6 text-center text-sm">{cal.motivo}</p>
        ) : !cal?.tieneCalendario ? (
          <p className="rounded-2xl bg-surface p-6 text-center text-sm text-zinc-500">
            No encontramos un “Calendario mensual” dentro de la página de este cliente en Notion.
          </p>
        ) : (
          <CalendarioCliente publicaciones={cal.publicaciones} />
        )}
      </section>
    </div>
  );
}

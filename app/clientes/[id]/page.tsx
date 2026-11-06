import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarioCliente } from "@/components/CalendarioCliente";
import { Logo } from "@/components/Logo";
import { formatFecha, formatPago } from "@/lib/clientes";
import { getCalendario, getComentariosCliente, getDatos } from "@/lib/datos";
import { FollowUpCliente } from "@/components/FollowUpCliente";
import { estado as estadoFollowUp, followUps } from "@/lib/followup";

export const revalidate = 60;

// Las fichas se guardan en caché (ISR) desde la primera visita: las siguientes cargan al instante.
export async function generateStaticParams() {
  return [];
}

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
  const datos = await getDatos();
  const c = datos.clientes.find((x) => x.id === id);
  if (!c) notFound();
  const casos = datos.casos.filter((k) => k.cliente === c.id);
  const nombreDe = new Map(datos.equipo.map((p) => [p.id, p.nombre]));
  const sinContenido = c.planes.length > 0 && c.planes.every((p) => PLANES_SIN_CONTENIDO.has(p));
  // Calendario, comentarios y follow up se piden en paralelo (antes iban uno detrás de otro).
  const [fus, com, cal] = await Promise.all([followUps(), getComentariosCliente(c.id, c.notionUrl), sinContenido ? null : getCalendario(c.notionUrl)]);
  const fu = fus[c.id];
  const comentarios = com.comentarios;

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
        <Logo cliente={c} size={72} casos={casos.length} />
        <div className="min-w-0">
          <h1 className="text-3xl font-black tracking-tight">
            {c.nombre}
            <span className="punto text-accent">.</span>
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

      <div className="mt-6">
        <FollowUpCliente id={c.id} estado={fu ? estadoFollowUp(fu) : null} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
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

      <section className={`mt-6 rounded-3xl border bg-white p-4 md:p-6 ${casos.length ? "border-accent/40" : "border-zinc-200"}`}>
        <h2 className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
          Casos abiertos<span className="-ml-2 text-accent">.</span>
          <span className={`rounded-full px-2 py-0.5 text-xs ${casos.length ? "bg-accent text-white" : "bg-surface text-zinc-500"}`}>{casos.length}</span>
        </h2>
        {casos.length ? (
          <ul className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
            {casos.map((k) => (
              <li key={k.notionUrl}>
                <a href={k.notionUrl} target="_blank" rel="noreferrer" className="relative block overflow-hidden rounded-2xl border border-zinc-200 p-4 pl-5 hover:border-ink">
                  <span className={`absolute inset-y-0 left-0 w-1 ${k.gravedad === "Leve" ? "bg-zinc-300" : "bg-accent"}`} />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${k.gravedad === "Leve" ? "bg-surface text-ink/70" : "bg-accent text-white"}`}>
                      {k.gravedad === "URGENTE" ? "Urgente" : k.gravedad}
                    </span>
                    <span className="font-bold">{k.titulo}</span>
                  </div>
                  {k.situacion && <p className="mt-1 line-clamp-2 text-sm text-zinc-600">{k.situacion}</p>}
                  <p className="mt-2 text-xs text-zinc-500">
                    Cargado el {k.fecha.split("-").reverse().join("/")}
                    {k.responsables?.length ? ` · ${k.responsables.map((r) => nombreDe.get(r) ?? r).join(", ")}` : ""}
                  </p>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">Este cliente no tiene casos abiertos.</p>
        )}
      </section>

      <section className="mt-6 rounded-3xl border border-zinc-200 bg-white p-4 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
            Comentarios<span className="punto -ml-2 text-accent">.</span>
            {comentarios.length > 0 && <span className="rounded-full bg-surface px-2 text-xs font-bold">{comentarios.length}</span>}
          </h2>
          <a href={c.notionUrl} target="_blank" rel="noreferrer" className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold hover:border-ink">
            Abrir cliente en Notion ↗
          </a>
        </div>
        {com.motivo ? (
          <p className="text-sm text-zinc-500">{com.motivo}</p>
        ) : comentarios.length ? (
          <ul className="space-y-2">
            {comentarios.map((k) => (
              <li key={k.id} className="rounded-2xl border border-zinc-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400">
                  <span>
                    <span className="font-bold text-zinc-600">{k.autor}</span> ·{" "}
                    {new Date(k.fecha).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" })}
                  </span>
                  <a href={k.notionUrl} target="_blank" rel="noreferrer" className="hover:text-ink">
                    Ver en Notion ↗
                  </a>
                </div>
                <p className="mt-1 whitespace-pre-line text-sm">{k.texto}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">Todavía no hay comentarios sobre este cliente en Notion.</p>
        )}
      </section>

      <section className="mt-6 rounded-3xl border border-zinc-200 bg-white p-4 md:p-6">
        <h2 className="mb-4 text-xl font-black uppercase tracking-tight">
          Calendario de contenido<span className="punto text-accent">.</span>
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

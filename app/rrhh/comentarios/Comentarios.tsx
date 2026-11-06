"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Logo } from "@/components/Logo";
import type { ClienteMin } from "@/lib/equipo";
import type { Comentario } from "@/lib/notion";

const ease = [0.22, 1, 0.36, 1] as const;
const iniciales = (n: string) => n.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
const CLAVE = "yb_comentarios_leidos";
// Estado "leído" guardado en este navegador (no toca Notion).
let enMemoria = "[]";
function leerRaw() {
  try {
    return localStorage.getItem(CLAVE) ?? enMemoria;
  } catch {
    return enMemoria;
  }
}
function guardarLeidos(s: Set<string>) {
  enMemoria = JSON.stringify([...s]);
  try {
    localStorage.setItem(CLAVE, enMemoria);
  } catch {
    // sin almacenamiento disponible: queda solo para esta visita
  }
  window.dispatchEvent(new Event("yb-leidos"));
}
function suscribir(cb: () => void) {
  window.addEventListener("yb-leidos", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("yb-leidos", cb);
    window.removeEventListener("storage", cb);
  };
}

const normalizar = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

function cuando(iso: string) {
  const d = new Date(iso);
  const fecha = d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" });
  const hora = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" });
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  const rel = min < 1 ? "recién" : min < 60 ? `hace ${min} min` : min < 1440 ? `hace ${Math.round(min / 60)} h` : `hace ${Math.round(min / 1440)} días`;
  return { fecha, hora, rel };
}

export function Comentarios({
  comentarios,
  motivo,
  clientes,
  equipo,
}: {
  comentarios: Comentario[];
  motivo?: string;
  clientes: ClienteMin[];
  equipo: { nombre: string; rol: string }[];
}) {
  const [recientes, setRecientes] = useState(true);
  const [cliente, setCliente] = useState("");
  const [autor, setAutor] = useState("");
  const raw = useSyncExternalStore(suscribir, leerRaw, () => "[]");
  const leidos = useMemo(() => {
    try {
      return new Set<string>(JSON.parse(raw));
    } catch {
      return new Set<string>();
    }
  }, [raw]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [verLeidos, setVerLeidos] = useState(false);
  const cli = new Map(clientes.map((c) => [c.id, c]));

  const actualizar = (ids: string[], leido: boolean) => {
    const n = new Set(leidos);
    for (const id of ids) {
      if (leido) n.add(id);
      else n.delete(id);
    }
    guardarLeidos(n);
    setSel(new Set());
  };
  const alternar = (id: string) =>
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // El rol se toma de la Nómina si el nombre del autor coincide (nombre completo o primer nombre + apellido).
  const rolDe = (nombre: string) => {
    const n = normalizar(nombre);
    return equipo.find((p) => normalizar(p.nombre) === n || n.startsWith(normalizar(p.nombre)) || normalizar(p.nombre).startsWith(n))?.rol;
  };

  const autores = useMemo(() => [...new Set(comentarios.map((c) => c.autor))].sort(), [comentarios]);
  const conComentarios = useMemo(() => [...new Set(comentarios.map((c) => c.cliente))], [comentarios]);

  const lista = comentarios
    .filter((c) => (!cliente || c.cliente === cliente) && (!autor || c.autor === autor))
    .filter((c) => (verLeidos ? leidos.has(c.id) : !leidos.has(c.id)))
    .sort((a, b) => (recientes ? b.fecha.localeCompare(a.fecha) : a.fecha.localeCompare(b.fecha)));

  const select = "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm";

  return (
    <div className="mx-auto max-w-4xl">
      <motion.header initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }} className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Recursos Humanos</p>
        <h1 className="mt-1 text-3xl font-black uppercase tracking-tight">
          Comentarios<span className="punto text-accent">.</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-500">Comentarios hechos en Notion sobre cada cliente, por orden de llegada. Marcarlos como leídos no cambia nada en Notion.</p>
      </motion.header>

      {motivo && (
        <div className="mb-6 rounded-2xl bg-accent-soft/60 p-4 text-sm">
          <p className="font-bold">No se pudieron cargar los comentarios.</p>
          <p className="mt-0.5">{motivo}</p>
        </div>
      )}

      {/* Filtros */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <select value={cliente} onChange={(e) => setCliente(e.target.value)} className={select}>
          <option value="">Todos los clientes</option>
          {conComentarios
            .map((id) => cli.get(id))
            .filter((c): c is ClienteMin => !!c)
            .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
        </select>
        <select value={autor} onChange={(e) => setAutor(e.target.value)} className={select}>
          <option value="">Todas las personas</option>
          {autores.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <div className="inline-flex rounded-full bg-surface p-1 sm:ml-auto">
          {[
            [true, "Más recientes"],
            [false, "Más antiguos"],
          ].map(([v, l]) => (
            <button key={String(v)} onClick={() => setRecientes(v as boolean)} className="relative rounded-full px-3 py-1.5 text-xs font-semibold">
              {recientes === v && <motion.span layoutId="orden-com" className="absolute inset-0 rounded-full bg-ink" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
              <span className={`relative ${recientes === v ? "text-white" : "text-zinc-500"}`}>{l as string}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Barra de selección */}
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl bg-surface px-3 py-2 text-xs">
        <label className="flex cursor-pointer items-center gap-2 font-semibold">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[#d30805]"
            checked={lista.length > 0 && lista.every((c) => sel.has(c.id))}
            onChange={(e) => setSel(e.target.checked ? new Set(lista.map((c) => c.id)) : new Set())}
          />
          Seleccionar todos
        </label>
        <span className="text-zinc-500">
          {lista.length} {lista.length === 1 ? "comentario" : "comentarios"} {verLeidos ? "leídos" : "sin leer"}
          {sel.size > 0 && ` · ${sel.size} seleccionados`}
        </span>
        <AnimatePresence>
          {sel.size > 0 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={() => actualizar([...sel], !verLeidos)}
              className="rounded-full bg-accent px-3 py-1.5 font-bold text-white"
            >
              {verLeidos ? "Marcar como no leídos" : "Marcar como leídos"}
            </motion.button>
          )}
        </AnimatePresence>
        <button onClick={() => { setVerLeidos(!verLeidos); setSel(new Set()); }} className="ml-auto font-semibold text-zinc-500 hover:text-ink">
          {verLeidos ? "← Volver a sin leer" : `Ver leídos (${comentarios.filter((c) => leidos.has(c.id)).length})`}
        </button>
      </div>

      {/* Línea de tiempo */}
      <ol className="relative space-y-3 border-l border-zinc-200 pl-6">
        <AnimatePresence mode="popLayout">
          {lista.map((k, i) => {
            const c = cli.get(k.cliente);
            const t = cuando(k.fecha);
            const rol = rolDe(k.autor);
            return (
              <motion.li
                key={k.id}
                layout
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 40, height: 0, marginTop: 0, transition: { duration: 0.3, ease } }}
                transition={{ delay: Math.min(i, 12) * 0.04, duration: 0.45, ease }}
                className="relative"
              >
                <span className={`absolute -left-[31px] top-5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${i === 0 && recientes && !verLeidos ? "bg-accent" : "bg-ink"}`} />
                <article className={`rounded-2xl border bg-white p-4 transition-colors ${sel.has(k.id) ? "border-ink" : "border-zinc-200"}`}>
                  <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <input type="checkbox" aria-label="Seleccionar" className="h-4 w-4 accent-[#d30805]" checked={sel.has(k.id)} onChange={() => alternar(k.id)} />
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">{iniciales(k.autor)}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold">{k.autor}</p>
                      <p className="text-[11px] text-zinc-400">{rol ?? "Notion"}</p>
                    </div>
                    <span className="text-zinc-300">→</span>
                    {c ? (
                      <Link href={`/clientes/${c.id}`} className="flex items-center gap-2 text-sm font-semibold hover:text-accent">
                        <Logo cliente={c} size={24} />
                        {c.nombre}
                      </Link>
                    ) : (
                      <span className="text-sm text-zinc-500">Cliente</span>
                    )}
                    <div className="ml-auto text-right">
                      <p className="text-xs font-semibold tabular-nums">
                        {t.fecha} · {t.hora}
                      </p>
                      <p className="text-[11px] text-zinc-400">{t.rel}</p>
                    </div>
                  </header>
                  <p className="mt-3 whitespace-pre-line text-sm text-zinc-700">{k.texto}</p>
                  <div className="mt-2 flex items-center gap-4 text-xs font-semibold">
                    <button onClick={() => actualizar([k.id], !verLeidos)} className="text-ink hover:text-accent">
                      {verLeidos ? "Marcar como no leído" : "✓ Marcar como leído"}
                    </button>
                    <a href={k.notionUrl} target="_blank" rel="noreferrer" className="text-zinc-400 hover:text-accent">
                      Responder en Notion ↗
                    </a>
                  </div>
                </article>
              </motion.li>
            );
          })}
        </AnimatePresence>
        {!lista.length && !motivo && (
          <li className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-400">
            {verLeidos ? "No hay comentarios marcados como leídos." : comentarios.length ? "Estás al día: no hay comentarios sin leer." : "Todavía no hay comentarios en las páginas de clientes."}
          </li>
        )}
      </ol>
    </div>
  );
}

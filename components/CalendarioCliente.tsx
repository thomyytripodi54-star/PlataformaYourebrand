"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Publicacion } from "@/lib/notion";

const ease = [0.22, 1, 0.36, 1] as const;
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// Mismos colores que los estados en Notion, para que el equipo los reconozca.
const COLORES: Record<string, string> = {
  default: "#9b9a97",
  gray: "#9b9a97",
  brown: "#8a6a5a",
  orange: "#d9730d",
  yellow: "#cb9b00",
  green: "#0f7b6c",
  blue: "#0b6e99",
  purple: "#6940a5",
  pink: "#ad1a72",
  red: "#e03e3e",
};
const color = (c: string | null) => COLORES[c ?? "default"] ?? COLORES.default;

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const lunes = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};
const sumar = (d: Date, dias: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + dias);
const hora = (f: string) => (f.length > 10 ? new Date(f).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : null);

function Miniatura({ p, alto }: { p: Publicacion; alto: number }) {
  const img = p.archivos.find((a) => a.imagen);
  if (!img) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={img.url}
      alt=""
      loading="lazy"
      decoding="async"
      style={{ height: alto }}
      className="w-full rounded-md bg-surface object-cover"
      onError={(e) => (e.currentTarget.style.display = "none")}
    />
  );
}

function Tarjeta({ p, onClick, grande = false }: { p: Publicacion; onClick: () => void; grande?: boolean }) {
  const c = color(p.colorEstado);
  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease }}
      whileHover={{ y: -1 }}
      onClick={onClick}
      className="group w-full rounded-lg border border-zinc-200 bg-white p-1.5 text-left hover:border-ink"
      style={{ borderLeft: `3px solid ${c}` }}
    >
      {grande && <Miniatura p={p} alto={96} />}
      <p className={`text-[11px] font-semibold leading-tight ${grande ? "mt-1.5 line-clamp-3 text-xs" : "truncate"}`}>{p.titulo}</p>
      <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-zinc-500">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c }} />
        {p.estado ?? "Sin estado"}
        {p.fecha && hora(p.fecha) && <span className="text-zinc-400">· {hora(p.fecha)}</span>}
      </p>
      {grande && p.copy && <p className="mt-1 line-clamp-3 text-[11px] text-zinc-600">{p.copy}</p>}
    </motion.button>
  );
}

function Detalle({ p, onClose }: { p: Publicacion; onClose: () => void }) {
  const c = color(p.colorEstado);
  const fecha = p.fecha
    ? new Date(p.fecha.length > 10 ? p.fecha : p.fecha + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })
    : "Sin fecha";
  return (
    <>
      <motion.div className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.4, ease }}
        className="fixed bottom-0 right-0 top-0 z-50 w-full max-w-md overflow-y-auto bg-white shadow-2xl"
      >
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-zinc-100 bg-white p-5">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: c }}>
              {p.estado ?? "Sin estado"}
            </span>
            <h3 className="mt-2 text-lg font-bold leading-snug">{p.titulo}</h3>
            <p className="text-sm text-zinc-500 first-letter:uppercase">
              {fecha}
              {p.fecha && hora(p.fecha) ? ` · ${hora(p.fecha)}` : ""}
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="text-2xl leading-none text-zinc-400 hover:text-ink">
            ×
          </button>
        </div>
        <div className="space-y-5 p-5">
          {p.archivos.length > 0 && (
            <section>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Archivos</h4>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {p.archivos.map((a, i) => (
                  <a key={i} href={a.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-zinc-200 hover:border-ink">
                    {a.imagen ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.url} alt={a.nombre} loading="lazy" decoding="async" className="aspect-square w-full object-cover" />
                    ) : (
                      <span className="flex aspect-square items-center justify-center p-2 text-center text-xs text-zinc-500">📎 {a.nombre}</span>
                    )}
                  </a>
                ))}
              </div>
            </section>
          )}
          {p.copy && (
            <section>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Copy</h4>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{p.copy}</p>
            </section>
          )}
          <div className="flex flex-wrap gap-2">
            {p.url && (
              <a href={p.url} target="_blank" rel="noreferrer" className="rounded-full bg-ink px-4 py-2 text-xs font-bold text-white hover:bg-black">
                Abrir Drive / link ↗
              </a>
            )}
            <a href={p.notionUrl} target="_blank" rel="noreferrer" className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-bold hover:border-ink">
              Ver en Notion ↗
            </a>
          </div>
        </div>
      </motion.aside>
    </>
  );
}

export function CalendarioCliente({ publicaciones }: { publicaciones: Publicacion[] }) {
  const hoy = new Date();
  const [vista, setVista] = useState<"semana" | "mes">("mes");
  const [ancla, setAncla] = useState(() => new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()));
  const [dir, setDir] = useState(0);
  const [filtro, setFiltro] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<Publicacion | null>(null);

  const estados = useMemo(() => {
    const m = new Map<string, { color: string | null; n: number }>();
    for (const p of publicaciones) {
      const k = p.estado ?? "Sin estado";
      m.set(k, { color: p.colorEstado, n: (m.get(k)?.n ?? 0) + 1 });
    }
    return [...m.entries()];
  }, [publicaciones]);

  const porDia = useMemo(() => {
    const m = new Map<string, Publicacion[]>();
    for (const p of publicaciones) {
      if (!p.fecha || (filtro && (p.estado ?? "Sin estado") !== filtro)) continue;
      const k = p.fecha.length > 10 ? iso(new Date(p.fecha)) : p.fecha.slice(0, 10);
      m.set(k, [...(m.get(k) ?? []), p]);
    }
    for (const l of m.values()) l.sort((a, b) => (a.fecha ?? "").localeCompare(b.fecha ?? ""));
    return m;
  }, [publicaciones, filtro]);
  const sinFecha = publicaciones.filter((p) => !p.fecha && (!filtro || (p.estado ?? "Sin estado") === filtro));

  // Días visibles
  const dias: Date[] = [];
  if (vista === "semana") {
    const l = lunes(ancla);
    for (let i = 0; i < 7; i++) dias.push(sumar(l, i));
  } else {
    const inicio = lunes(new Date(ancla.getFullYear(), ancla.getMonth(), 1));
    const fin = new Date(ancla.getFullYear(), ancla.getMonth() + 1, 0);
    for (let d = inicio; d <= fin || dias.length % 7; d = sumar(d, 1)) dias.push(d);
  }
  const enRango = dias.reduce((s, d) => s + (vista === "mes" && d.getMonth() !== ancla.getMonth() ? 0 : (porDia.get(iso(d))?.length ?? 0)), 0);

  const mover = (n: number) => {
    setDir(n);
    setAncla((a) => (vista === "semana" ? sumar(a, 7 * n) : new Date(a.getFullYear(), a.getMonth() + n, 1)));
  };
  const titulo =
    vista === "mes"
      ? `${MESES[ancla.getMonth()]} ${ancla.getFullYear()}`
      : (() => {
          const l = lunes(ancla);
          const d = sumar(l, 6);
          return `${l.getDate()} ${MESES[l.getMonth()].slice(0, 3)} – ${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
        })();
  const clave = `${vista}-${iso(vista === "semana" ? lunes(ancla) : new Date(ancla.getFullYear(), ancla.getMonth(), 1))}`;

  return (
    <div>
      {/* Barra superior */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => mover(-1)} aria-label="Anterior" className="h-9 w-9 rounded-full border border-zinc-200 bg-white text-lg hover:border-ink">
            ‹
          </button>
          <button onClick={() => mover(1)} aria-label="Siguiente" className="h-9 w-9 rounded-full border border-zinc-200 bg-white text-lg hover:border-ink">
            ›
          </button>
          <button
            onClick={() => {
              setDir(0);
              setAncla(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()));
            }}
            className="ml-1 h-9 rounded-full border border-zinc-200 bg-white px-4 text-xs font-bold hover:border-ink"
          >
            Hoy
          </button>
        </div>
        <h3 className="text-lg font-black capitalize tracking-tight">
          {titulo}
          <span className="punto text-accent">.</span>
          <span className="ml-2 text-xs font-normal normal-case text-zinc-400">{enRango} publicaciones</span>
        </h3>
        <div className="ml-auto inline-flex rounded-full bg-surface p-1">
          {(["semana", "mes"] as const).map((v) => (
            <button key={v} onClick={() => setVista(v)} className="relative rounded-full px-4 py-1.5 text-xs font-bold">
              {vista === v && <motion.span layoutId="vista-cal" className="absolute inset-0 rounded-full bg-ink" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
              <span className={`relative ${vista === v ? "text-white" : "text-zinc-500"}`}>{v === "semana" ? "Semana" : "Mes"}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Estados (leyenda + filtro) */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {estados.map(([nombre, { color: col, n }]) => {
          const activo = filtro === nombre;
          return (
            <button
              key={nombre}
              onClick={() => setFiltro(activo ? null : nombre)}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                activo ? "border-ink bg-ink text-white" : filtro ? "border-zinc-200 bg-white text-zinc-400" : "border-zinc-200 bg-white text-zinc-700 hover:border-ink"
              }`}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: color(col) }} />
              {nombre}
              <span className={activo ? "text-white/60" : "text-zinc-400"}>{n}</span>
            </button>
          );
        })}
      </div>

      {/* Grilla */}
      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-7 gap-px text-center text-[11px] font-bold uppercase tracking-wider text-zinc-400">
            {DIAS.map((d) => (
              <div key={d} className="pb-2">
                {d}
              </div>
            ))}
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-200">
            <AnimatePresence mode="popLayout" initial={false} custom={dir}>
              <motion.div
                key={clave}
                custom={dir}
                initial={{ opacity: 0, x: dir * 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: dir * -40 }}
                transition={{ duration: 0.35, ease }}
                className="grid grid-cols-7 gap-px"
              >
                {dias.map((d) => {
                  const k = iso(d);
                  const lista = porDia.get(k) ?? [];
                  const fuera = vista === "mes" && d.getMonth() !== ancla.getMonth();
                  const esHoy = k === iso(hoy);
                  const max = vista === "mes" ? 3 : 99;
                  return (
                    <div key={k} className={`${vista === "mes" ? "min-h-[118px]" : "min-h-[420px]"} p-1.5 ${fuera ? "bg-surface/70" : "bg-white"}`}>
                      <div className="mb-1 flex items-center justify-between px-0.5">
                        <span
                          className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-bold ${
                            esHoy ? "bg-accent text-white" : fuera ? "text-zinc-300" : "text-ink"
                          }`}
                        >
                          {d.getDate()}
                        </span>
                        {vista === "semana" && lista.length > 0 && <span className="text-[10px] text-zinc-400">{lista.length}</span>}
                      </div>
                      <div className="space-y-1">
                        {lista.slice(0, max).map((p) => (
                          <Tarjeta key={p.id} p={p} onClick={() => setAbierta(p)} grande={vista === "semana"} />
                        ))}
                        {lista.length > max && (
                          <button
                            onClick={() => {
                              setDir(0);
                              setAncla(d);
                              setVista("semana");
                            }}
                            className="w-full rounded-md px-1 py-0.5 text-left text-[11px] font-semibold text-zinc-500 hover:text-accent"
                          >
                            + {lista.length - max} más
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {sinFecha.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Sin fecha asignada · {sinFecha.length}</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {sinFecha.map((p) => (
              <Tarjeta key={p.id} p={p} onClick={() => setAbierta(p)} />
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>{abierta && <Detalle key={abierta.id} p={abierta} onClose={() => setAbierta(null)} />}</AnimatePresence>
    </div>
  );
}

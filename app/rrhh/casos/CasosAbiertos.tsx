"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Logo } from "@/components/Logo";
import type { Caso, ClienteMin } from "@/lib/equipo";

const ease = [0.22, 1, 0.36, 1] as const;
type Gravedad = Caso["gravedad"];
type PersonaMin = { id: string; nombre: string; rol: string };

const NIVELES: { id: Gravedad; label: string; desc: string }[] = [
  { id: "URGENTE", label: "Urgente", desc: "Resolver hoy" },
  { id: "Grave", label: "Grave", desc: "Riesgo de baja" },
  { id: "Leve", label: "Leve", desc: "Seguimiento" },
];

const estilo: Record<Gravedad, { badge: string; barra: string }> = {
  URGENTE: { badge: "bg-accent text-white", barra: "bg-accent" },
  Grave: { badge: "border border-accent text-accent", barra: "bg-accent/60" },
  Leve: { badge: "bg-surface text-ink/70", barra: "bg-zinc-300" },
};

function diasDesde(iso: string) {
  const hoy = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00");
  const d = Math.round((hoy.getTime() - new Date(iso + "T00:00:00").getTime()) / 86400000);
  return d <= 0 ? "hoy" : d === 1 ? "hace 1 día" : `hace ${d} días`;
}
const iniciales = (n: string) => n.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

export function CasosAbiertos({ casos, clientes, equipo }: { casos: Caso[]; clientes: ClienteMin[]; equipo: PersonaMin[] }) {
  const [filtro, setFiltro] = useState<Gravedad | null>(null);
  const cli = new Map(clientes.map((c) => [c.id, c]));
  const per = new Map(equipo.map((p) => [p.id, p]));
  const lista = casos.filter((c) => !filtro || c.gravedad === filtro);
  const cuenta = (g: Gravedad) => casos.filter((c) => c.gravedad === g).length;

  return (
    <div className="mx-auto max-w-5xl">
      <motion.header initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }} className="mb-8">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Recursos Humanos</p>
        <h1 className="mt-1 text-3xl font-black uppercase tracking-tight">
          Casos abiertos<span className="punto text-accent">.</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-500">Ordenados por importancia y, dentro de cada nivel, del más reciente al más antiguo.</p>
      </motion.header>

      {/* Resumen por nivel (también funciona como filtro) */}
      <div className="grid grid-cols-3 gap-3">
        {NIVELES.map((n, i) => {
          const activo = filtro === n.id;
          return (
            <motion.button
              key={n.id}
              onClick={() => setFiltro(activo ? null : n.id)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.07, duration: 0.45, ease }}
              whileHover={{ y: -2 }}
              className={`rounded-2xl p-4 text-left transition-colors ${activo ? "bg-ink text-white" : "border border-zinc-200 bg-white hover:border-ink"}`}
            >
              <p className={`text-4xl font-black tracking-tight ${n.id === "Leve" && !activo ? "text-ink" : "text-accent"}`}>{cuenta(n.id)}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wider">{n.label}</p>
              <p className={`text-[11px] ${activo ? "text-white/50" : "text-zinc-400"}`}>{n.desc}</p>
            </motion.button>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-between text-xs text-zinc-500">
        <span>
          {lista.length} {lista.length === 1 ? "caso" : "casos"}
          {filtro ? ` · ${NIVELES.find((n) => n.id === filtro)!.label}` : ""}
        </span>
        {filtro && (
          <button onClick={() => setFiltro(null)} className="font-semibold text-ink hover:text-accent">
            Ver todos
          </button>
        )}
      </div>

      <motion.ul layout className="mt-3 space-y-2">
        <AnimatePresence mode="popLayout">
          {lista.map((c, i) => {
            const cliente = c.cliente ? cli.get(c.cliente) : undefined;
            const resp = (c.responsables ?? []).map((id) => per.get(id)).filter((p): p is PersonaMin => !!p);
            return (
              <motion.li
                key={c.notionUrl}
                layout
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
                transition={{ delay: 0.2 + Math.min(i, 12) * 0.04, duration: 0.45, ease }}
                className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white"
              >
                <span className={`absolute inset-y-0 left-0 w-1 ${estilo[c.gravedad].barra}`} />
                <div className="flex flex-col gap-3 p-4 pl-5 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    {cliente ? <Logo cliente={cliente} size={40} /> : <div className="h-10 w-10 shrink-0 rounded-full bg-surface" />}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${estilo[c.gravedad].badge}`}>
                          {c.gravedad === "URGENTE" ? "Urgente" : c.gravedad}
                        </span>
                        <p className="font-bold">{c.titulo}</p>
                      </div>
                      <p className="mt-0.5 text-sm text-zinc-500">
                        {cliente ? (
                          <Link href={`/clientes/${cliente.id}`} className="font-medium text-ink hover:text-accent">
                            {cliente.nombre}
                          </Link>
                        ) : (
                          "Cliente sin asignar"
                        )}
                      </p>
                      {c.situacion && <p className="mt-1 line-clamp-2 text-sm text-zinc-600">{c.situacion}</p>}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <div className="flex -space-x-2">
                      {resp.map((p) => (
                        <span
                          key={p.id}
                          title={`${p.nombre} · ${p.rol}`}
                          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-ink text-[11px] font-semibold text-white"
                        >
                          {iniciales(p.nombre)}
                        </span>
                      ))}
                    </div>
                    <div className="w-28 text-right">
                      <p className="text-[11px] uppercase tracking-wider text-zinc-400">Cargado</p>
                      <p className="text-sm font-semibold tabular-nums">{c.fecha.split("-").reverse().join("/")}</p>
                      <p className="text-[11px] text-zinc-400">{diasDesde(c.fecha)}</p>
                    </div>
                    <a href={c.notionUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-zinc-400 hover:text-accent">
                      Notion ↗
                    </a>
                  </div>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
        {!lista.length && <li className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-400">Sin casos abiertos.</li>}
      </motion.ul>
    </div>
  );
}

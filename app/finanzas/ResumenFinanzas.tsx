"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { MESES } from "@/lib/finanzas";

const ease = [0.22, 1, 0.36, 1] as const;
const usd = (n: number) => `USD ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n)}`;
const pct = (n: number) => `${(n * 100).toFixed(1).replace(".", ",")}%`;
const mesLargo = (m: { anio: number; mes: number }) => `${MESES[m.mes - 1]} ${m.anio}`;

type Props = {
  reservas: { serie: { anio: number; mes: number; total: number }[]; composicion: { anio: number; mes: number; liquidez: number; invertido: number; deudas: number } | null };
  er: { anio: number; mes: number; ingresosUsd: number; utilidadUsd: number; utilidadPct: number; margenPct: number; utilidadUsdAnterior: number | null; clientes: number } | null;
  pendiente: { anio: number; mes: number; atrasado: boolean } | null;
};

function Delta({ actual, anterior, etiqueta }: { actual: number; anterior?: number | null; etiqueta: string }) {
  if (anterior === undefined || anterior === null || !anterior) return null;
  const d = (actual - anterior) / Math.abs(anterior);
  return (
    <span className="text-xs text-zinc-500">
      <span className={`font-semibold tabular-nums ${d > 0.0005 ? "text-emerald-600" : d < -0.0005 ? "text-red-600" : "text-zinc-400"}`}>
        {d >= 0 ? "▲" : "▼"} {Math.abs(d * 100).toFixed(0)}%
      </span>{" "}
      {etiqueta}
    </span>
  );
}

/** Tendencia de una sola serie (sin ejes: el detalle está en la página de reservas). */
function Tendencia({ valores }: { valores: number[] }) {
  if (valores.length < 2) return null;
  const max = Math.max(...valores) * 1.05;
  const pts = valores.map((v, i) => [(i / (valores.length - 1)) * 100, 40 - (v / max) * 36] as const);
  const linea = pts.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-16 w-full" aria-hidden>
      <path d={`${linea} L100,40 L0,40 Z`} fill="rgba(255,255,255,0.08)" />
      <motion.path d={linea} fill="none" stroke="#fff" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.3, ease }} />
    </svg>
  );
}

function Tarjeta({ href, titulo, sub, i, children }: { href: string; titulo: string; sub: string; i: number; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + i * 0.1, duration: 0.6, ease }}>
      <Link href={href} className="group flex h-full flex-col rounded-3xl border border-zinc-200 bg-white p-6 transition-colors hover:border-ink">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xl font-black uppercase tracking-tight">
              {titulo}
              <span className="punto text-accent">.</span>
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>
          </div>
          <span className="text-lg text-zinc-400 transition-transform group-hover:translate-x-1 group-hover:text-ink">→</span>
        </div>
        {children}
      </Link>
    </motion.div>
  );
}

export function ResumenFinanzas({ reservas, er, pendiente }: Props) {
  const serie = reservas.serie;
  const ult = serie.at(-1);
  const ant = serie.at(-2);
  const c = reservas.composicion;
  return (
    <div className="mx-auto max-w-7xl">
      <motion.header initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }} className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Finanzas</p>
        <h1 className="mt-1 text-3xl font-black uppercase tracking-tight">
          Resumen<span className="punto text-accent">.</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-500">Cuánta plata tiene la agencia y cómo cerró el último mes.</p>
      </motion.header>

      {pendiente && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <Link href="/finanzas/estado-de-resultados" className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-accent/40 bg-accent-soft px-5 py-3 text-sm hover:border-accent">
            <span className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full bg-accent ${pendiente.atrasado ? "animate-pulse" : ""}`} />
              {mesLargo(pendiente)} está {pendiente.atrasado ? "atrasado" : "pendiente"} de consolidar.
            </span>
            <span className="font-bold">Consolidar →</span>
          </Link>
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Tarjeta href="/finanzas/reservas" titulo="Reservas" sub={ult ? `Poder de fuego al cierre de ${mesLargo(ult).toLowerCase()}` : "Sin datos"} i={0}>
          {ult && (
            <>
              <p className="mt-6 text-4xl font-black tracking-tight tabular-nums">{usd(ult.total)}</p>
              <Delta actual={ult.total} anterior={ant?.total} etiqueta={ant ? `vs ${MESES[ant.mes - 1].toLowerCase()}` : ""} />
              <div className="mt-4">
                <Tendencia valores={serie.map((m) => m.total)} />
              </div>
              {c && (
                <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-zinc-200 pt-4 text-sm">
                  {[
                    ["Liquidez", c.liquidez],
                    ["Invertido", c.invertido],
                    ["Deudas", c.deudas],
                  ].map(([k, v]) => (
                    <div key={k as string}>
                      <dt className="text-[11px] text-zinc-500">{k as string}</dt>
                      <dd className="font-bold tabular-nums">
                        {(v as number) < 0 ? "−" : ""}
                        {usd(Math.abs(v as number))}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </>
          )}
        </Tarjeta>

        <Tarjeta href="/finanzas/estado-de-resultados" titulo="Estado de resultados" sub={er ? `Último mes consolidado: ${mesLargo(er).toLowerCase()}` : "Sin meses consolidados"} i={1}>
          {er && (
            <>
              <p className="mt-6 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Utilidad neta</p>
              <p className="mt-1 text-4xl font-black tracking-tight tabular-nums">{usd(er.utilidadUsd)}</p>
              <span className="flex flex-wrap gap-x-3">
                <span className="text-xs text-zinc-500">
                  <span className="font-semibold text-ink">{pct(er.utilidadPct)}</span> de los ingresos
                </span>
                <Delta actual={er.utilidadUsd} anterior={er.utilidadUsdAnterior} etiqueta="vs mes anterior" />
              </span>
              <dl className="mt-auto grid grid-cols-3 gap-3 border-t border-zinc-200 pt-4 text-sm">
                <div>
                  <dt className="text-[11px] text-zinc-500">Ingresos</dt>
                  <dd className="font-bold tabular-nums">{usd(er.ingresosUsd)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-zinc-500">Margen operativo</dt>
                  <dd className="font-bold tabular-nums">{pct(er.margenPct)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-zinc-500">Clientes</dt>
                  <dd className="font-bold tabular-nums">{er.clientes}</dd>
                </div>
              </dl>
            </>
          )}
        </Tarjeta>
      </div>
    </div>
  );
}

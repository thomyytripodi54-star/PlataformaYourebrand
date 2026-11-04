"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion } from "motion/react";
import { Logo } from "@/components/Logo";
import { MapaClientes } from "@/components/MapaClientes";
import type { Cliente } from "@/lib/clientes";
import type { Caso } from "@/lib/equipo";

export type Vista = "estadisticas" | "satisfaccion" | "geografia";
const ease = [0.22, 1, 0.36, 1] as const;

const TABS: { id: Vista; label: string }[] = [
  { id: "geografia", label: "Geografía" },
  { id: "satisfaccion", label: "Satisfacción" },
  { id: "estadisticas", label: "Estadísticas" },
];

const ars = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
const eur = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

/* ---------- piezas comunes ---------- */
const entero = (n: number) => String(Math.round(n));

function Numero({ valor, formato = entero }: { valor: number; formato?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const c = animate(0, valor, { duration: 1.1, ease, onUpdate: (v) => (el.textContent = formato(v)) });
    return () => c.stop();
  }, [valor, formato]);
  return <span ref={ref}>{formato(0)}</span>;
}

function Tile({ label, children, nota, i = 0, destacado = false }: { label: string; children: React.ReactNode; nota?: React.ReactNode; i?: number; destacado?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 + i * 0.07, duration: 0.5, ease }}
      className={`rounded-2xl p-5 ${destacado ? "bg-ink text-white" : "border border-zinc-200 bg-white"}`}
    >
      <p className={`text-[11px] font-bold uppercase tracking-wider ${destacado ? "text-white/50" : "text-zinc-400"}`}>{label}</p>
      <div className="mt-2 text-[1.7rem] font-black leading-tight tracking-tight tabular-nums 2xl:text-4xl">{children}</div>
      {nota && <div className={`mt-2 text-xs ${destacado ? "text-white/60" : "text-zinc-500"}`}>{nota}</div>}
    </motion.div>
  );
}

/* ---------- Estadísticas ---------- */
function Estadisticas({ clientes, casos }: { clientes: Cliente[]; casos: Caso[] }) {
  const brutoArs = clientes.reduce((s, c) => s + (c.pagoMensual?.moneda === "ARS" ? c.pagoMensual.monto : 0), 0);
  const brutoEur = clientes.reduce((s, c) => s + (c.pagoMensual?.moneda === "EUR" ? c.pagoMensual.monto : 0), 0);
  const neto = clientes.reduce((s, c) => s + (c.margen ?? 0), 0);
  const conAmbos = clientes.filter((c) => c.pagoMensual?.moneda === "ARS" && c.margen);
  const margenPct = conAmbos.length
    ? conAmbos.reduce((s, c) => s + c.margen!, 0) / conAmbos.reduce((s, c) => s + c.pagoMensual!.monto, 0)
    : 0;
  const porGravedad = (g: Caso["gravedad"]) => casos.filter((c) => c.gravedad === g).length;
  const sinDatos = clientes.filter((c) => !c.pagoMensual).length;

  const ranking = clientes.filter((c) => c.margen).sort((a, b) => b.margen! - a.margen!);
  const max = ranking[0]?.margen ?? 1;
  const [hover, setHover] = useState<string | null>(null);

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Ingresos brutos / mes" i={0} destacado nota={<>+ <span className="font-bold text-white">{eur(brutoEur)}</span> de clientes en euros</>}>
          <Numero valor={brutoArs} formato={ars} />
        </Tile>
        <Tile label="Ingresos netos / mes" i={1} nota={<>Margen de contribución · <span className="font-bold text-ink">{Math.round(margenPct * 100)}%</span> sobre facturación en ARS</>}>
          <span className="text-accent"><Numero valor={neto} formato={ars} /></span>
        </Tile>
        <Tile label="Casos abiertos" i={2} nota={<>{porGravedad("URGENTE")} urgentes · {porGravedad("Grave")} graves · {porGravedad("Leve")} leves</>}>
          <Link href="/rrhh/casos" className="hover:text-accent"><Numero valor={casos.length} /></Link>
        </Tile>
        <Tile label="Clientes activos" i={3} nota={sinDatos ? `${sinDatos} sin facturación cargada en Notion` : "Todos con facturación cargada"}>
          <Numero valor={clientes.length} />
        </Tile>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.5, ease }}
        className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5"
      >
        <h2 className="text-sm font-bold uppercase tracking-wider">Ingresos netos por cliente<span className="text-accent">.</span></h2>
        <p className="mt-0.5 text-xs text-zinc-500">Margen de contribución mensual en ARS, de mayor a menor.</p>
        <ul className="mt-4 space-y-1.5">
          {ranking.map((c, i) => {
            const activo = hover === c.id;
            return (
              <li key={c.id} onMouseEnter={() => setHover(c.id)} onMouseLeave={() => setHover(null)}>
                <Link href={`/clientes/${c.id}`} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 rounded-lg px-1 py-1 sm:grid-cols-[minmax(0,13rem)_1fr_auto]">
                  <span className={`truncate text-xs ${activo ? "font-bold" : "text-zinc-600"}`}>{c.nombre}</span>
                  <span className="relative h-4">
                    <motion.span
                      className={`absolute inset-y-0 left-0 rounded-r-[4px] ${activo ? "bg-accent" : "bg-ink"}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${(c.margen! / max) * 100}%` }}
                      transition={{ delay: 0.45 + i * 0.025, duration: 0.7, ease }}
                    />
                  </span>
                  <span className={`w-28 text-right text-xs tabular-nums ${activo ? "font-bold" : "text-zinc-500"}`}>{ars(c.margen!)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </motion.section>
    </div>
  );
}

/* ---------- Satisfacción ---------- */
const NIVELES = [
  { id: "Contento", color: "#272626", texto: "text-white" },
  { id: "Expectante", color: "#7d7d7d", texto: "text-white" },
  { id: "Insatisfecho", color: "#d30805", texto: "text-white" },
] as const;

function Satisfaccion({ clientes, casosPorCliente }: { clientes: Cliente[]; casosPorCliente: Record<string, number> }) {
  const grupos = NIVELES.map((n) => ({ ...n, clientes: clientes.filter((c) => c.satisfaccion === n.id) }));
  const sinDato = clientes.filter((c) => !c.satisfaccion);
  const total = clientes.length || 1;
  const [hover, setHover] = useState<string | null>(null);

  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        {grupos.map((g, i) => (
          <Tile key={g.id} label={g.id} i={i} nota={`${Math.round((g.clientes.length / total) * 100)}% de la cartera`}>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: g.color }} />
              <Numero valor={g.clientes.length} />
            </span>
          </Tile>
        ))}
      </div>

      {/* Barra de proporción con hover */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="relative mt-6">
        <div className="flex h-10 gap-[2px] overflow-hidden rounded-xl">
          {grupos
            .filter((g) => g.clientes.length)
            .map((g, i) => (
              <motion.div
                key={g.id}
                onMouseEnter={() => setHover(g.id)}
                onMouseLeave={() => setHover(null)}
                className={`flex items-center justify-center text-xs font-bold ${g.texto}`}
                style={{ background: g.color, opacity: hover && hover !== g.id ? 0.45 : 1 }}
                initial={{ flexGrow: 0.0001 }}
                animate={{ flexGrow: g.clientes.length }}
                transition={{ delay: 0.35 + i * 0.1, duration: 0.8, ease }}
              >
                <span className="truncate px-2">{g.id} · {g.clientes.length}</span>
              </motion.div>
            ))}
        </div>
        {sinDato.length > 0 && <p className="mt-2 text-xs text-zinc-400">{sinDato.length} cliente(s) sin satisfacción cargada en Notion.</p>}
      </motion.div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {grupos.map((g, gi) => (
          <motion.section
            key={g.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + gi * 0.08, duration: 0.5, ease }}
            className={`rounded-2xl border bg-white p-4 transition-colors ${hover === g.id ? "border-ink" : "border-zinc-200"}`}
          >
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: g.color }} />
              <span>{g.id}<span className="text-accent">.</span></span>
              <span className="ml-auto text-xs font-normal text-zinc-400">{g.clientes.length}</span>
            </h3>
            {g.clientes.length ? (
              <ul className="mt-3 space-y-1">
                {g.clientes.map((c) => (
                  <li key={c.id}>
                    <Link href={`/clientes/${c.id}`} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 hover:bg-surface">
                      <Logo cliente={c} size={26} casos={casosPorCliente[c.id] ?? 0} />
                      <span className="truncate text-sm">{c.nombre}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-zinc-400">Ningún cliente.</p>
            )}
          </motion.section>
        ))}
      </div>
    </div>
  );
}

/* ---------- Dashboard ---------- */
export function Dashboard({ clientes, casos, vistaInicial }: { clientes: Cliente[]; casos: Caso[]; vistaInicial: Vista }) {
  const [vista, setVista] = useState<Vista>(vistaInicial);
  const casosPorCliente: Record<string, number> = {};
  for (const k of casos) if (k.cliente) casosPorCliente[k.cliente] = (casosPorCliente[k.cliente] ?? 0) + 1;
  const cambiar = (v: Vista) => {
    setVista(v);
    window.history.replaceState(null, "", v === "geografia" ? "/clientes/dashboard" : `/clientes/dashboard?vista=${v}`);
  };

  return (
    <div className="mx-auto max-w-7xl">
      <motion.header initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }} className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Dirección</p>
        <h1 className="mt-1 text-3xl font-black uppercase tracking-tight">
          Dashboard de clientes<span className="text-accent">.</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-500">{clientes.length} clientes activos</p>
      </motion.header>

      <div className="mb-6 inline-flex rounded-full bg-surface p-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => cambiar(t.id)} className="relative rounded-full px-4 py-2 text-sm font-semibold">
            {vista === t.id && (
              <motion.span layoutId="tab-dashboard" className="absolute inset-0 rounded-full bg-ink" transition={{ type: "spring", stiffness: 400, damping: 34 }} />
            )}
            <span className={`relative ${vista === t.id ? "text-white" : "text-zinc-500 hover:text-ink"}`}>{t.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={vista} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25, ease }}>
          {vista === "estadisticas" && <Estadisticas clientes={clientes} casos={casos} />}
          {vista === "satisfaccion" && <Satisfaccion clientes={clientes} casosPorCliente={casosPorCliente} />}
          {vista === "geografia" && <MapaClientes clientes={clientes} embebido casos={casos} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

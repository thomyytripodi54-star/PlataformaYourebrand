"use client";

import type { FollowUpVista } from "@/components/FollowUpCliente";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion } from "motion/react";
import { Logo } from "@/components/Logo";
import { MapaClientes, type MapaHandle } from "@/components/MapaClientes";
import { useRouter } from "next/navigation";
import { porEntrada, type Cliente } from "@/lib/clientes";
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
        <h2 className="text-sm font-bold uppercase tracking-wider">Ingresos netos por cliente<span className="punto text-accent">.</span></h2>
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
                      className={`absolute inset-y-0 left-0 rounded-r-[4px] ${activo ? "bg-accent" : "bg-white/70"}`}
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
              <span>{g.id}<span className="punto text-accent">.</span></span>
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

/* ---------- Buscador ---------- */
const normalizar = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function Buscador({ clientes, casosPorCliente, onMapa }: { clientes: Cliente[]; casosPorCliente: Record<string, number>; onMapa: (id: string) => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [i, setI] = useState(0);
  const t = normalizar(q.trim());
  const res = t
    ? clientes
        .filter((c) => [c.nombre, c.contacto, c.instagram, c.pais, ...c.rubros, ...(c.ubicacion ?? []), ...c.planes].some((v) => v && normalizar(v).includes(t)))
        .sort((a, b) => Number(!normalizar(a.nombre).startsWith(t)) - Number(!normalizar(b.nombre).startsWith(t)) || a.nombre.localeCompare(b.nombre, "es"))
        .slice(0, 8)
    : [];
  const ir = (id: string) => {
    setAbierto(false);
    router.push(`/clientes/${id}`);
  };
  return (
    <div className="relative w-full sm:w-80">
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setAbierto(true);
          setI(0);
        }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") setI((x) => Math.min(x + 1, res.length - 1));
          if (e.key === "ArrowUp") setI((x) => Math.max(x - 1, 0));
          if (e.key === "Enter" && res[i]) ir(res[i].id);
          if (e.key === "Escape") setAbierto(false);
        }}
        placeholder="Buscar cliente, rubro, barrio…"
        className="w-full rounded-full border border-zinc-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-ink"
      />
      <svg className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <AnimatePresence>
        {abierto && t && (
          <motion.ul
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="absolute right-0 z-30 mt-2 w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl sm:w-[26rem]"
          >
            {res.length ? (
              res.map((c, k) => (
                <li key={c.id} onMouseEnter={() => setI(k)} className={`flex items-center gap-3 px-3 py-2 ${k === i ? "bg-surface" : ""}`}>
                  <button onMouseDown={() => ir(c.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <Logo cliente={c} size={32} casos={casosPorCliente[c.id] ?? 0} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{c.nombre}</span>
                      <span className="block truncate text-[11px] text-zinc-500">{[c.ubicacion?.[0], c.rubros[0]].filter(Boolean).join(" · ") || c.pais}</span>
                    </span>
                  </button>
                  {c.pais && (
                    <button
                      onMouseDown={() => {
                        setAbierto(false);
                        setQ("");
                        onMapa(c.id);
                      }}
                      className="shrink-0 rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] font-bold hover:border-ink"
                    >
                      Ver en mapa
                    </button>
                  )}
                </li>
              ))
            ) : (
              <li className="px-4 py-3 text-sm text-zinc-400">Sin resultados para “{q}”.</li>
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- Dashboard ---------- */
export function Dashboard({ clientes: clientesProp, casos, vistaInicial, followUp = [], estadosFollowUp = {} }: { clientes: Cliente[]; casos: Caso[]; vistaInicial: Vista; followUp?: string[]; estadosFollowUp?: Record<string, FollowUpVista> }) {
  // Orden de entrada (fecha "Desde"), no alfabético
  const clientes = [...clientesProp].sort(porEntrada);
  const [vista, setVista] = useState<Vista>(vistaInicial);
  const casosPorCliente: Record<string, number> = {};
  for (const k of casos) if (k.cliente) casosPorCliente[k.cliente] = (casosPorCliente[k.cliente] ?? 0) + 1;
  const mapaRef = useRef<MapaHandle>(null);
  const verEnMapa = (id: string) => {
    cambiar("geografia");
    // el mapa puede tardar un instante en montarse al cambiar de pestaña
    let intentos = 0;
    const probar = () => {
      if (mapaRef.current) mapaRef.current.enfocar(id);
      else if (intentos++ < 20) setTimeout(probar, 80);
    };
    probar();
  };
  const cambiar = (v: Vista) => {
    setVista(v);
    window.history.replaceState(null, "", v === "geografia" ? "/clientes/dashboard" : `/clientes/dashboard?vista=${v}`);
  };

  const pestanas = (oscuro: boolean) => (
    <div className={`inline-flex w-fit rounded-full p-1 ${oscuro ? "bg-white/[0.06]" : "bg-surface"}`}>
      {TABS.map((t) => (
        <button key={t.id} onClick={() => cambiar(t.id)} className="relative rounded-full px-4 py-2 text-sm font-semibold">
          {vista === t.id && (
            <motion.span layoutId="tab-dashboard" className={`absolute inset-0 rounded-full ${oscuro ? "bg-white" : "bg-ink"}`} transition={{ type: "spring", stiffness: 400, damping: 34 }} />
          )}
          <span className={`relative ${vista === t.id ? (oscuro ? "text-ink" : "text-white") : oscuro ? "text-white/60 hover:text-white" : "text-zinc-500 hover:text-ink"}`}>{t.label}</span>
        </button>
      ))}
    </div>
  );

  // Geografía: mapa a pantalla completa con los clientes a la derecha.
  if (vista === "geografia")
    return (
      <MapaClientes
        ref={mapaRef}
        clientes={clientes}
        casos={casos}
        embebido
        pantallaCompleta
        followUp={followUp}
        estadosFollowUp={estadosFollowUp}
        cabecera={
          <div className="mb-6 space-y-3 text-ink">
            {pestanas(true)}
            <Buscador clientes={clientes} casosPorCliente={casosPorCliente} onMapa={verEnMapa} />
          </div>
        }
      />
    );

  return (
    <div className="mx-auto max-w-7xl">
      <motion.header initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }} className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Dirección</p>
        <h1 className="mt-1 text-3xl font-black uppercase tracking-tight">
          Dashboard de clientes<span className="punto text-accent">.</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-500">{clientes.length} clientes activos</p>
      </motion.header>

      <div className="mb-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
      {pestanas(false)}
        <Buscador clientes={clientes} casosPorCliente={casosPorCliente} onMapa={verEnMapa} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={vista} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25, ease }}>
          {vista === "estadisticas" && <Estadisticas clientes={clientes} casos={casos} />}
          {vista === "satisfaccion" && <Satisfaccion clientes={clientes} casosPorCliente={casosPorCliente} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

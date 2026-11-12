"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { MESES } from "@/lib/finanzas";
import { TIPOS, clave, composicion, type CuentaReserva, type ReservaMes, type TipoCuenta } from "@/lib/reservas";
import { guardarMesReservas } from "./actions";

const ease = [0.22, 1, 0.36, 1] as const;
const usd = (n: number) => `USD ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n)}`;
const usd2 = (n: number) => `USD ${new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;
const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
const mesCorto = (m: { anio: number; mes: number }) => `${MESES[m.mes - 1].slice(0, 3)} ${String(m.anio).slice(2)}`;
const mesLargo = (m: { anio: number; mes: number }) => `${MESES[m.mes - 1]} ${m.anio}`;
const compacto = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 })}K` : String(n));

function Variacion({ actual, anterior, etiqueta }: { actual: number; anterior?: number; etiqueta: string }) {
  if (anterior === undefined || !anterior) return null;
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

function Tile({ label, valor, nota, i }: { label: string; valor: string; nota?: React.ReactNode; i: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.07, duration: 0.5, ease }} className="rounded-2xl border border-zinc-200 bg-white p-5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">{label}</p>
      <p className="mt-2 text-[1.7rem] font-black leading-tight tracking-tight tabular-nums">{valor}</p>
      {nota && <div className="mt-1.5">{nota}</div>}
    </motion.div>
  );
}

/* ---------- Evolución (una serie: área + línea, con cursor y tooltip) ---------- */
function Evolucion({ meses }: { meses: ReservaMes[] }) {
  const caja = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(800);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAncho(Math.max(300, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const alto = 240;
  const m = { izq: 44, der: 28, arr: 16, aba: 28 };
  const valores = meses.map((x) => x.totalUsd);
  const tope = Math.max(...valores, 1) * 1.12;
  const paso = [1000, 2000, 2500, 5000, 10000, 20000, 25000, 50000].find((p) => tope / p <= 5) ?? 100000;
  const maxY = Math.ceil(tope / paso) * paso;
  const ticks = Array.from({ length: maxY / paso + 1 }, (_, i) => i * paso);
  const x = (i: number) => m.izq + (meses.length === 1 ? 0 : (i / (meses.length - 1)) * (ancho - m.izq - m.der));
  const y = (v: number) => m.arr + (1 - v / maxY) * (alto - m.arr - m.aba);
  const linea = valores.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
  const area = `${linea} L${x(valores.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  const ult = valores.length - 1;
  const mover = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    let mejor = 0;
    for (let i = 1; i < meses.length; i++) if (Math.abs(x(i) - px) < Math.abs(x(mejor) - px)) mejor = i;
    setHover(mejor);
  };
  const h = hover ?? null;
  return (
    <div ref={caja} className="relative">
      <svg width={ancho} height={alto} className="block" onMouseMove={mover} onMouseLeave={() => setHover(null)} role="img" aria-label="Evolución de las reservas totales por mes, en USD">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.izq} x2={ancho - m.der} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
            <text x={m.izq - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="rgba(255,255,255,0.4)">
              {compacto(t)}
            </text>
          </g>
        ))}
        {meses.map((mm, i) => (
          <text key={clave(mm)} x={x(i)} y={alto - 8} textAnchor="middle" fontSize={11} fill={h === i ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.4)"}>
            {mesCorto(mm)}
          </text>
        ))}
        <motion.path d={area} fill="rgba(255,255,255,0.08)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.3 }} />
        <motion.path d={linea} fill="none" stroke="#fff" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease }} />
        {h !== null && <line x1={x(h)} x2={x(h)} y1={m.arr} y2={alto - m.aba} stroke="rgba(255,255,255,0.25)" strokeWidth={1} />}
        {/* Punto final con su valor (la etiqueta directa de la serie); al pasar el mouse, el punto del mes. */}
        <circle cx={x(h ?? ult)} cy={y(valores[h ?? ult])} r={5} fill="#fff" stroke="#1d1c1c" strokeWidth={2} />
        {h === null && (
          <text x={x(ult) - 10} y={y(valores[ult]) - 12} textAnchor="end" fontSize={12} fontWeight={700} fill="rgba(255,255,255,0.9)">
            {usd(valores[ult])}
          </text>
        )}
      </svg>
      {h !== null && (
        <div
          className="pointer-events-none absolute top-2 z-10 rounded-xl border border-white/10 bg-[#161515]/95 px-3 py-2 text-xs shadow-xl"
          style={{ left: Math.min(Math.max(x(h) - 80, 0), ancho - 170), width: 160 }}
        >
          <p className="font-bold text-white">{mesLargo(meses[h])}</p>
          <p className="mt-0.5 tabular-nums text-white/80">{usd2(valores[h])}</p>
          {h > 0 && (
            <p className={`mt-0.5 tabular-nums ${valores[h] >= valores[h - 1] ? "text-emerald-400" : "text-red-400"}`}>
              {valores[h] >= valores[h - 1] ? "+" : "−"}
              {usd(Math.abs(valores[h] - valores[h - 1]))} vs {MESES[meses[h - 1].mes - 1].toLowerCase()}
            </p>
          )}
          {!meses[h].cuentas && <p className="mt-0.5 text-white/40">Solo total (sin desglose)</p>}
        </div>
      )}
    </div>
  );
}

/* ---------- Distribución por cuenta (barras horizontales de una sola magnitud) ---------- */
function Distribucion({ mes }: { mes: ReservaMes }) {
  const activos = (mes.cuentas ?? []).filter((c) => c.tipo !== "deudas" && c.montoUsd > 0).sort((a, b) => b.montoUsd - a.montoUsd);
  const deudas = (mes.cuentas ?? []).filter((c) => c.tipo === "deudas");
  const totalActivos = activos.reduce((s, c) => s + c.montoUsd, 0);
  const max = Math.max(...activos.map((c) => c.montoUsd), 1);
  return (
    <div>
      <ul className="space-y-2.5">
        {activos.map((c, i) => (
          <li key={c.nombre} className="grid grid-cols-[minmax(0,8.5rem)_1fr] items-center gap-3">
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{c.nombre}</span>
              <span className="block truncate text-[11px] text-zinc-500">{TIPOS[c.tipo].nombre}</span>
            </span>
            <span className="flex items-center gap-2.5">
              <motion.span
                className="block h-5 rounded-r-[4px] bg-white/80"
                initial={{ width: 0 }}
                animate={{ width: `${(c.montoUsd / max) * 72}%` }}
                transition={{ delay: 0.2 + i * 0.06, duration: 0.7, ease }}
              />
              <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                <span className="font-semibold text-ink">{usd(c.montoUsd)}</span> · {pct(c.montoUsd / totalActivos)}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {deudas.map((d) => (
        <p key={d.nombre} className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-3 text-sm">
          <span>
            <span className="font-semibold">{d.nombre}</span> <span className="text-[11px] text-zinc-500">{d.montoUsd >= 0 ? "a cobrar, suma al total" : "a pagar, resta del total"}</span>
          </span>
          <span className="font-semibold tabular-nums">
            {d.montoUsd >= 0 ? "+" : "−"}
            {usd(Math.abs(d.montoUsd))}
          </span>
        </p>
      ))}
    </div>
  );
}

/* ---------- Carga mensual ---------- */
function CargarMes({ meses, onClose }: { meses: ReservaMes[]; onClose: () => void }) {
  const router = useRouter();
  const [guardando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const ultimo = meses.at(-1);
  const siguiente = ultimo ? (ultimo.mes === 12 ? { anio: ultimo.anio + 1, mes: 1 } : { anio: ultimo.anio, mes: ultimo.mes + 1 }) : { anio: 2026, mes: 11 };
  const [periodo, setPeriodo] = useState(siguiente);
  const plantilla = [...meses].reverse().find((m) => m.cuentas)?.cuentas ?? [{ nombre: "Banco", tipo: "banco" as const, montoUsd: 0 }];
  const existente = meses.find((m) => clave(m) === clave(periodo));
  const inicial = (existente?.cuentas ?? plantilla).map((c) => ({ ...c, monto: String(c.montoUsd) }));
  const [filas, setFilas] = useState(inicial);
  const [nota, setNota] = useState(existente?.nota ?? "");
  const [periodoPrevio, setPeriodoPrevio] = useState(periodo);
  // Al cambiar de mes, se proponen los valores ya cargados de ese mes (o las cuentas del último desglose).
  if (clave(periodoPrevio) !== clave(periodo)) {
    setPeriodoPrevio(periodo);
    setFilas(inicial);
    setNota(existente?.nota ?? "");
  }
  const total = filas.reduce((s, f) => s + (Number(f.monto.replace(",", ".")) || 0), 0);
  const anios = [siguiente.anio - 1, siguiente.anio];
  const cambiar = (i: number, cambio: Partial<(typeof filas)[number]>) => setFilas((fs) => fs.map((f, j) => (j === i ? { ...f, ...cambio } : f)));
  const guardar = () =>
    iniciar(async () => {
      const cuentas: CuentaReserva[] = filas.map((f) => ({ nombre: f.nombre, tipo: f.tipo, montoUsd: Number(f.monto.replace(",", ".")) }));
      const r = await guardarMesReservas({ ...periodo, cuentas, nota });
      if (!r.ok) return setError(r.error);
      router.refresh();
      onClose();
    });

  return (
    <>
      <motion.div className="fixed inset-0 z-40 bg-ink/50 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !guardando && onClose()} />
      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.4, ease }}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-zinc-200 bg-white"
        aria-label="Cargar reservas del mes"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-5">
          <p className="text-lg font-black tracking-tight">
            Cargar reservas<span className="punto text-accent">.</span>
          </p>
          <button onClick={onClose} className="text-2xl leading-none text-zinc-400 hover:text-ink" aria-label="Cerrar">
            ×
          </button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="flex gap-2">
            <select value={periodo.mes} onChange={(e) => setPeriodo({ ...periodo, mes: Number(e.target.value) })} className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm">
              {MESES.map((n, i) => (
                <option key={n} value={i + 1}>
                  {n}
                </option>
              ))}
            </select>
            <select value={periodo.anio} onChange={(e) => setPeriodo({ ...periodo, anio: Number(e.target.value) })} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm">
              {anios.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </div>
          {existente && <p className="text-xs text-zinc-500">Este mes ya tiene datos: al guardar se reemplazan.</p>}

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Cuentas (USD)</p>
            <ul className="space-y-2">
              {filas.map((f, i) => (
                <li key={i} className="grid grid-cols-[1fr_7.5rem_6.5rem_1.25rem] items-center gap-1.5">
                  <input value={f.nombre} onChange={(e) => cambiar(i, { nombre: e.target.value })} placeholder="Cuenta" className="min-w-0 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm" />
                  <select value={f.tipo} onChange={(e) => cambiar(i, { tipo: e.target.value as TipoCuenta })} className="min-w-0 rounded-lg border border-zinc-200 bg-white px-1.5 py-1.5 text-xs">
                    {(Object.keys(TIPOS) as TipoCuenta[]).map((t) => (
                      <option key={t} value={t}>
                        {TIPOS[t].nombre}
                      </option>
                    ))}
                  </select>
                  <input value={f.monto} onChange={(e) => cambiar(i, { monto: e.target.value })} inputMode="decimal" className="min-w-0 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-right text-sm tabular-nums" />
                  <button onClick={() => setFilas((fs) => fs.filter((_, j) => j !== i))} className="text-zinc-400 hover:text-ink" aria-label={`Quitar ${f.nombre}`}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <button onClick={() => setFilas((fs) => [...fs, { nombre: "", tipo: "acciones", montoUsd: 0, monto: "0" }])} className="mt-2 text-xs font-semibold text-zinc-500 hover:text-ink">
              + Agregar cuenta (por ejemplo, acciones)
            </button>
            <p className="mt-2 text-[11px] text-zinc-500">Las deudas van con signo: positivo si nos deben, negativo si debemos.</p>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Nota (opcional)</p>
            <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} maxLength={300} className="w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="border-t border-zinc-200 px-6 py-4">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-sm text-zinc-500">Total {mesLargo(periodo)}</span>
            <span className="text-xl font-black tabular-nums">{usd2(total)}</span>
          </div>
          {error && <p className="mb-2 text-xs text-accent">{error}</p>}
          <button onClick={guardar} disabled={guardando} className="w-full rounded-2xl bg-ink py-3 text-sm font-bold text-white disabled:opacity-50">
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </motion.aside>
    </>
  );
}

/* ---------- Página ---------- */
export function Reservas({ meses }: { meses: ReservaMes[] }) {
  const [cargando, setCargando] = useState(false);
  const ultimo = meses.at(-1);
  const anterior = meses.at(-2);
  const inicioAnio = ultimo ? meses.find((m) => m.anio === ultimo.anio) : undefined;
  const conDesglose = [...meses].reverse().find((m) => m.cuentas);
  const comp = conDesglose ? composicion(conDesglose) : null;
  const desglose = conDesglose && ultimo && clave(conDesglose) !== clave(ultimo) ? ` (a ${MESES[conDesglose.mes - 1].toLowerCase()})` : "";

  return (
    <div className="mx-auto max-w-7xl">
      <motion.header initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }} className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Finanzas</p>
          <h1 className="mt-1 text-3xl font-black uppercase tracking-tight">
            Reservas<span className="punto text-accent">.</span>
          </h1>
          <p className="mt-1 text-sm text-zinc-500">El poder de fuego de la agencia, mes a mes (USD).</p>
        </div>
        <button onClick={() => setCargando(true)} className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-white hover:bg-accent">
          + Cargar mes
        </button>
      </motion.header>

      {ultimo && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Tile
            i={0}
            label={`Reservas totales · ${mesLargo(ultimo).toLowerCase()}`}
            valor={usd(ultimo.totalUsd)}
            nota={
              <div className="flex flex-col gap-0.5">
                <Variacion actual={ultimo.totalUsd} anterior={anterior?.totalUsd} etiqueta={anterior ? `vs ${MESES[anterior.mes - 1].toLowerCase()}` : ""} />
                {inicioAnio && inicioAnio !== ultimo && <Variacion actual={ultimo.totalUsd} anterior={inicioAnio.totalUsd} etiqueta={`desde ${MESES[inicioAnio.mes - 1].toLowerCase()}`} />}
              </div>
            }
          />
          <Tile i={1} label={`Liquidez${desglose}`} valor={comp ? usd(comp.liquidez) : "—"} nota={<span className="text-xs text-zinc-500">Efectivo, bancos y billeteras</span>} />
          <Tile i={2} label={`Invertido${desglose}`} valor={comp ? usd(comp.invertido) : "—"} nota={<span className="text-xs text-zinc-500">Cripto, broker y acciones</span>} />
          <Tile
            i={3}
            label={`Deudas${desglose}`}
            valor={comp ? `${comp.deudas >= 0 ? "+" : "−"}${usd(Math.abs(comp.deudas))}` : "—"}
            nota={<span className="text-xs text-zinc-500">{comp && comp.deudas >= 0 ? "A cobrar (suma)" : "A pagar (resta)"}</span>}
          />
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-[1.6fr_1fr]">
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5, ease }} className="rounded-2xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider">
            Evolución<span className="punto text-accent">.</span>
          </h2>
          <p className="mb-3 mt-0.5 text-xs text-zinc-500">Reservas totales al cierre de cada mes, en USD.</p>
          {meses.length > 0 && <Evolucion meses={meses} />}
        </motion.section>
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.5, ease }} className="rounded-2xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider">
            Distribución<span className="punto text-accent">.</span>
          </h2>
          <p className="mb-4 mt-0.5 text-xs text-zinc-500">{conDesglose ? `Dónde está la plata, ${mesLargo(conDesglose).toLowerCase()}.` : "Todavía no hay un mes con desglose por cuenta."}</p>
          {conDesglose && <Distribucion mes={conDesglose} />}
        </motion.section>
      </div>

      <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.5, ease }} className="mt-3 overflow-x-auto rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider">
          Historial<span className="punto text-accent">.</span>
        </h2>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-[11px] uppercase tracking-wider text-zinc-400">
              <th className="py-2 pr-3 font-bold">Mes</th>
              <th className="py-2 pr-3 text-right font-bold">Total</th>
              <th className="py-2 pr-3 text-right font-bold">Variación</th>
              <th className="py-2 font-bold">Desglose</th>
            </tr>
          </thead>
          <tbody>
            {[...meses].reverse().map((m) => {
              const i = meses.indexOf(m);
              const prev = meses[i - 1];
              const d = prev ? m.totalUsd - prev.totalUsd : null;
              return (
                <tr key={clave(m)} className="border-b border-zinc-100 align-top last:border-0">
                  <td className="py-2.5 pr-3 font-semibold">{mesLargo(m)}</td>
                  <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">{usd2(m.totalUsd)}</td>
                  <td className={`py-2.5 pr-3 text-right tabular-nums ${d === null || Math.abs(d) < 0.5 ? "text-zinc-400" : d > 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {d === null ? "—" : Math.abs(d) < 0.5 ? "sin cambios" : `${d > 0 ? "+" : "−"}${usd(Math.abs(d))}`}
                  </td>
                  <td className="py-2.5 text-xs text-zinc-500">
                    {m.cuentas ? m.cuentas.map((c) => `${c.nombre} ${c.montoUsd < 0 ? "−" : ""}${usd(Math.abs(c.montoUsd))}`).join(" · ") : "Solo total"}
                    {m.nota && <span className="block text-zinc-400">{m.nota}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </motion.section>

      <AnimatePresence>{cargando && <CargarMes meses={meses} onClose={() => setCargando(false)} />}</AnimatePresence>
    </div>
  );
}

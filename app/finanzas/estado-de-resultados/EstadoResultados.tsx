"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, MotionConfig, animate, motion, useReducedMotion } from "motion/react";
import { MESES, agregar, totales, trimestreDe, type Agregado, type MesER } from "@/lib/finanzas";
import { Consolidar } from "./Consolidar";

const ease = [0.22, 1, 0.36, 1] as const;
type Moneda = "ARS" | "USD";
type Pendiente = { anio: number; mes: number; atrasado: boolean } | null;

/* ---------- formato ---------- */
const fmtARS = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
const fmtUSD = (n: number) => "USD " + new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number) => new Intl.NumberFormat("es-AR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);
const fmtNum = (n: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n);

/** Count-up que respeta prefers-reduced-motion. */
function Cuenta({ valor, formato = fmtNum }: { valor: number; formato?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const quieto = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (quieto) {
      el.textContent = formato(valor);
      return;
    }
    const c = animate(0, valor, { duration: 0.9, ease, onUpdate: (v) => (el.textContent = formato(v)) });
    return () => c.stop();
  }, [valor, formato, quieto]);
  return <span ref={ref}>{formato(valor)}</span>;
}

/** Variación: verde/rojo solo acá. `invertir` para costos (bajar es bueno). */
function Variacion({ actual, anterior, invertir = false, pp = false }: { actual: number; anterior?: number | null; invertir?: boolean; pp?: boolean }) {
  if (anterior === undefined || anterior === null || (!pp && !anterior)) return <span className="text-zinc-300">—</span>;
  const d = pp ? actual - anterior : (actual - anterior) / Math.abs(anterior);
  const bueno = invertir ? d < 0 : d > 0;
  const txt = pp ? `${d >= 0 ? "+" : ""}${(d * 100).toFixed(1).replace(".", ",")} pp` : `${d >= 0 ? "▲" : "▼"} ${Math.abs(d * 100).toFixed(0)}%`;
  return <span className={`text-xs font-semibold tabular-nums ${Math.abs(d) < 0.0005 ? "text-zinc-400" : bueno ? "text-emerald-600" : "text-red-600"}`}>{txt}</span>;
}

function MiniTendencia({ valores }: { valores: number[] }) {
  if (valores.length < 2) return <div className="h-8" />;
  const min = Math.min(0, ...valores);
  const max = Math.max(...valores, 1);
  const pts = valores.map((v, i) => `${(i / (valores.length - 1)) * 100},${32 - ((v - min) / (max - min || 1)) * 28 - 2}`).join(" ");
  return (
    <svg viewBox="0 0 100 32" className="h-8 w-full" preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ---------- tarjetas ---------- */
function TarjetaPendiente({ mes, anio, atrasado, onClick }: { mes: number; anio: number; atrasado: boolean; onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      className={`relative flex min-h-44 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-white p-4 text-ink sm:aspect-square ${atrasado ? "border-accent" : "border-accent/50"}`}
    >
      <span className="absolute left-3 top-3 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
        {atrasado ? "Atrasado" : "Consolidación pendiente"}
      </span>
      <motion.span
        className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-4xl font-light text-white"
        animate={{ scale: [1, 1.06, 1], boxShadow: ["0 0 0 0 rgba(211,8,5,0.35)", "0 0 0 14px rgba(211,8,5,0)", "0 0 0 0 rgba(211,8,5,0)"] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
      >
        +
      </motion.span>
      <span className="mt-3 text-sm font-bold">
        {MESES[mes - 1]} {anio}
        <span className="text-accent">.</span>
      </span>
    </motion.button>
  );
}

/** "De cada $100 facturados": costos operativos, fijos, extras+impuestos y utilidad. */
function Reparto({ m, alto = "h-2.5", conLeyenda = false }: { m: MesER; alto?: string; conLeyenda?: boolean }) {
  const t = totales(m);
  const partes = [
    { k: "Costos operativos", v: t.costosOperativos, c: "#272626" },
    { k: "Costos fijos", v: t.costosFijos, c: "#7d7d7d" },
    { k: "Extras e impuestos", v: m.extras + m.impuestos + m.fees, c: "#d4d4d4" },
    { k: "Utilidad neta", v: Math.max(0, t.utilidadNeta), c: "#d30805" },
  ];
  const total = partes.reduce((s, p) => s + p.v, 0) || 1;
  return (
    <div>
      <div className={`flex ${alto} gap-[2px] overflow-hidden rounded-full`} role="img" aria-label="Reparto de los ingresos">
        {partes.map((p) => (
          <motion.span key={p.k} title={`${p.k}: ${fmtPct(p.v / (t.ingresosBrutos || 1))}`} style={{ background: p.c }} initial={{ flexGrow: 0 }} animate={{ flexGrow: p.v / total }} transition={{ duration: 0.6, ease }} />
        ))}
      </div>
      {conLeyenda && (
        <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
          {partes.map((p) => (
            <li key={p.k} className="flex items-center gap-1.5 text-zinc-600">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.c }} />
              {p.k} <b className="ml-auto tabular-nums text-ink">{fmtPct(p.v / (t.ingresosBrutos || 1))}</b>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TarjetaMes({ m, anterior, moneda, onClick, i }: { m: MesER; anterior?: MesER; moneda: Moneda; onClick: () => void; i: number }) {
  const t = totales(m);
  const ta = anterior ? totales(anterior) : null;
  return (
    <motion.button
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 + i * 0.07, duration: 0.35, ease }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="flex w-full flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 text-left text-ink hover:border-ink"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold">
          {MESES[m.mes - 1]}
          <span className="text-accent">.</span>
        </p>
        <Variacion actual={t.utilidadUsd} anterior={ta?.utilidadUsd ?? null} />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-zinc-400">Utilidad neta · {fmtPct(t.utilidadPct)}</p>
        <p className="text-2xl font-black tabular-nums text-accent">{moneda === "USD" ? fmtUSD(t.utilidadUsd) : fmtARS(t.utilidadNeta)}</p>
      </div>
      <Reparto m={m} />
      <dl className="grid grid-cols-3 gap-2 border-t border-zinc-100 pt-3 text-center">
        {[
          ["Ingresos", moneda === "USD" ? fmtUSD(t.ingresosUsd).replace("USD ", "") : `${(t.ingresosBrutos / 1e6).toFixed(1).replace(".", ",")}M`],
          ["Margen op.", fmtPct(t.margenPct)],
          ["Clientes", String(m.clientes)],
        ].map(([k, v]) => (
          <div key={k}>
            <dd className="text-sm font-bold tabular-nums">{v}</dd>
            <dt className="text-[10px] uppercase tracking-wider text-zinc-400">{k}</dt>
          </div>
        ))}
      </dl>
    </motion.button>
  );
}

/* ---------- ER completo de un mes ---------- */
function Fila({ label, ars, m, anterior, moneda, nivel = 0, invertir = false, sinDato = false }: {
  label: string; ars: number; m: MesER; anterior?: number | null; moneda: Moneda; nivel?: 0 | 1 | 2; invertir?: boolean; sinDato?: boolean;
}) {
  const t = totales(m);
  const valor = moneda === "USD" ? t.usd(ars) : ars;
  const ant = anterior === undefined || anterior === null ? null : moneda === "USD" ? anterior : anterior;
  return (
    <tr className={nivel === 2 ? "border-t-2 border-ink" : nivel === 1 ? "border-t border-zinc-200" : ""}>
      <td className={`py-1.5 pr-3 ${nivel === 0 ? "pl-4 text-zinc-600" : "font-bold"} ${nivel === 2 ? "text-base" : "text-sm"}`}>{label}</td>
      <td className={`py-1.5 text-right tabular-nums ${nivel ? "font-bold" : ""} ${nivel === 2 ? "text-base" : "text-sm"}`}>
        {sinDato ? <span className="text-zinc-300">—</span> : moneda === "USD" ? fmtUSD(valor) : fmtARS(valor)}
      </td>
      <td className="w-20 py-1.5 text-right text-xs tabular-nums text-zinc-500">{sinDato ? "" : fmtPct(t.pct(ars))}</td>
      <td className="w-20 py-1.5 text-right">{!sinDato && <Variacion actual={ars} anterior={ant} invertir={invertir} />}</td>
    </tr>
  );
}

/** Resumen del mes: lo que importa de un vistazo. */
function Resumen({ m, anterior, moneda }: { m: MesER; anterior?: MesER; moneda: Moneda }) {
  const t = totales(m);
  const ta = anterior ? totales(anterior) : null;
  // Mayores cambios contra el mes anterior (en ARS)
  const lineas: [string, number, number | undefined, boolean][] = [
    ["Ingresos RRSS mensual", m.ingresos.rrssMens, anterior?.ingresos.rrssMens, false],
    ["Ingresos diferidos", m.ingresos.rrssTrim + m.ingresos.rrssSems + m.ingresos.rrssAnual, anterior ? anterior.ingresos.rrssTrim + anterior.ingresos.rrssSems + anterior.ingresos.rrssAnual : undefined, false],
    ["Ingresos extras", m.ingresos.extras, anterior?.ingresos.extras, false],
    ["Costos operativos", t.costosOperativos, ta?.costosOperativos, true],
    ["Costos fijos", t.costosFijos, ta?.costosFijos, true],
    ["Extras", m.extras, anterior?.extras, true],
  ];
  const cambios = lineas
    .filter(([, , a]) => a !== undefined)
    .map(([k, v, a, inv]) => ({ k, v, d: v - (a as number), inv }))
    .sort((x, y) => Math.abs(y.d) - Math.abs(x.d))
    .slice(0, 3);
  const f = (ars: number) => (moneda === "USD" ? fmtUSD(t.usd(ars)) : fmtARS(ars));
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease }} className="space-y-6">
      <section>
        <h3 className="text-sm font-black uppercase tracking-tight">
          De cada $100 facturados<span className="text-accent">.</span>
        </h3>
        <div className="mt-3">
          <Reparto m={m} alto="h-4" conLeyenda />
        </div>
      </section>
      {cambios.length > 0 && (
        <section>
          <h3 className="text-sm font-black uppercase tracking-tight">
            Qué cambió vs {MESES[anterior!.mes - 1].toLowerCase()}
            <span className="text-accent">.</span>
          </h3>
          <ul className="mt-2 divide-y divide-zinc-100">
            {cambios.map((c) => {
              const bueno = c.inv ? c.d < 0 : c.d > 0;
              return (
                <li key={c.k} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-zinc-600">{c.k}</span>
                  <span className={`font-bold tabular-nums ${bueno ? "text-emerald-600" : "text-red-600"}`}>
                    {c.d >= 0 ? "+" : "−"}
                    {f(Math.abs(c.d)).replace("-", "")}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <section className="grid grid-cols-3 gap-2 rounded-xl bg-surface p-3 text-center">
        {[["Clientes", m.clientes], ["Entradas", m.entradas], ["Bajas", m.bajas]].map(([k, v]) => (
          <div key={k as string}>
            <p className="text-xl font-black tabular-nums">{v}</p>
            <p className="text-[10px] uppercase tracking-wider text-zinc-400">{k}</p>
          </div>
        ))}
      </section>
      {m.analisis.length > 0 && (
        <section>
          <h3 className="text-sm font-black uppercase tracking-tight">
            Análisis<span className="text-accent">.</span>
          </h3>
          <ul className="mt-2 space-y-1.5">
            {m.analisis.slice(0, 3).map((x) => (
              <li key={x} className="flex gap-2 text-sm text-zinc-700">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <span>{x.replace("(Borrador Claude)", "").trim()}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </motion.div>
  );
}

function DetalleMes({ m, anterior, moneda, setMoneda, onClose }: { m: MesER; anterior?: MesER; moneda: Moneda; setMoneda: (x: Moneda) => void; onClose: () => void }) {
  const [completo, setCompleto] = useState(false);
  const t = totales(m);
  const ta = anterior ? totales(anterior) : null;
  const a = anterior;
  const juntos = m.costosOperativos.produccion === null;
  const filaProps = { m, moneda };

  // Mezcla del margen: cada costo operativo como % de ingresos, mes contra mes
  const mezcla = [
    { k: juntos ? "CM / Editor / UGC" : "Community Managers", v: m.costosOperativos.communityManagers, va: a?.costosOperativos.communityManagers },
    ...(!juntos ? [{ k: "Producción", v: m.costosOperativos.produccion ?? 0, va: a?.costosOperativos.produccion ?? undefined }] : []),
    { k: "Desarrollo web", v: m.costosOperativos.desarrolloWeb, va: a?.costosOperativos.desarrolloWeb },
    { k: "Publicidad", v: m.costosOperativos.publicidad, va: a?.costosOperativos.publicidad },
  ].map((x) => ({ ...x, p: t.pct(x.v), pa: ta && x.va !== undefined ? x.va / ta.ingresosBrutos : null }));
  const maxP = Math.max(...mezcla.flatMap((x) => [x.p, x.pa ?? 0]), 0.01);

  return (
    <>
      <motion.div className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.35, ease }}
        className="fixed bottom-0 right-0 top-0 z-50 w-full max-w-2xl overflow-y-auto bg-white shadow-2xl"
      >
        <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-zinc-100 bg-white px-5 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-zinc-400">Estado de Resultados · Q{trimestreDe(m.mes)}</p>
            <h2 className="text-2xl font-black uppercase tracking-tight">
              {MESES[m.mes - 1]} {m.anio}
              <span className="text-accent">.</span>
            </h2>
          </div>
          <div className="ml-auto inline-flex rounded-full bg-surface p-1">
            {(["ARS", "USD"] as const).map((x) => (
              <button key={x} onClick={() => setMoneda(x)} className="relative rounded-full px-3 py-1 text-xs font-bold">
                {moneda === x && <motion.span layoutId="moneda-detalle" className="absolute inset-0 rounded-full bg-ink" transition={{ duration: 0.25, ease }} />}
                <span className={`relative ${moneda === x ? "text-white" : "text-zinc-500"}`}>{x}</span>
              </button>
            ))}
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="text-2xl leading-none text-zinc-400 hover:text-ink">
            ×
          </button>
        </header>

        <div className="space-y-6 p-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Ingresos brutos", moneda === "USD" ? fmtUSD(t.ingresosUsd) : fmtARS(t.ingresosBrutos)],
              ["Margen operativo", fmtPct(t.margenPct)],
              ["Utilidad neta", moneda === "USD" ? fmtUSD(t.utilidadUsd) : fmtARS(t.utilidadNeta)],
              ["% utilidad", fmtPct(t.utilidadPct)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-surface p-3">
                <p className="text-[10px] uppercase tracking-wider text-zinc-400">{k}</p>
                <p className="mt-1 text-lg font-black tabular-nums text-accent">{v}</p>
              </div>
            ))}
          </div>

          {!completo && <Resumen m={m} anterior={anterior} moneda={moneda} />}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setCompleto(!completo)} className="rounded-full bg-ink px-4 py-2 text-xs font-bold text-white hover:bg-black">
              {completo ? "← Volver al resumen" : "Ver detalle completo"}
            </button>
            {m.fuenteUrl && (
              <a href={m.fuenteUrl} target="_blank" rel="noreferrer" className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-bold hover:border-ink">
                Ver en Google Sheets ↗
              </a>
            )}
          </div>
          {completo && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease }} className="space-y-6">
          {/* ER */}
          <table className="w-full">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-zinc-400">
                <th className="pb-1 text-left font-semibold"> </th>
                <th className="pb-1 text-right font-semibold">{moneda}</th>
                <th className="pb-1 text-right font-semibold">% ing.</th>
                <th className="pb-1 text-right font-semibold">vs {a ? MESES[a.mes - 1].slice(0, 3) : "—"}</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={4} className="pt-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Ingresos</td></tr>
              <Fila {...filaProps} label="RRSS mensual" ars={m.ingresos.rrssMens} anterior={a?.ingresos.rrssMens} />
              <Fila {...filaProps} label="RRSS Trim diferidos" ars={m.ingresos.rrssTrim} anterior={a?.ingresos.rrssTrim} />
              <Fila {...filaProps} label="RRSS Sems diferidos" ars={m.ingresos.rrssSems} anterior={a?.ingresos.rrssSems} />
              <Fila {...filaProps} label="RRSS Anual diferidos" ars={m.ingresos.rrssAnual} anterior={a?.ingresos.rrssAnual} />
              <Fila {...filaProps} label="Extras" ars={m.ingresos.extras} anterior={a?.ingresos.extras} />
              <Fila {...filaProps} label="Ingresos brutos" ars={t.ingresosBrutos} anterior={ta?.ingresosBrutos} nivel={1} />

              <tr><td colSpan={4} className="pt-4 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Costos operativos</td></tr>
              <Fila {...filaProps} label={juntos ? "Community Managers / Editor / UGC" : "Community Managers"} ars={m.costosOperativos.communityManagers} anterior={a?.costosOperativos.communityManagers} invertir />
              <Fila {...filaProps} label="Producción (Editor/Creador/Filmaker)" ars={m.costosOperativos.produccion ?? 0} anterior={a?.costosOperativos.produccion} invertir sinDato={juntos} />
              <Fila {...filaProps} label="Desarrollo web" ars={m.costosOperativos.desarrolloWeb} anterior={a?.costosOperativos.desarrolloWeb} invertir />
              <Fila {...filaProps} label="Publicidad" ars={m.costosOperativos.publicidad} anterior={a?.costosOperativos.publicidad} invertir />
              <Fila {...filaProps} label="Margen operativo" ars={t.margenOperativo} anterior={ta?.margenOperativo} nivel={1} />

              <tr><td colSpan={4} className="pt-4 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Costos fijos</td></tr>
              <Fila {...filaProps} label="Gastos campañas" ars={m.costosFijos.campanas} anterior={a?.costosFijos.campanas} invertir />
              <Fila {...filaProps} label="Gasto redes orgánico" ars={m.costosFijos.organico} anterior={a?.costosFijos.organico} invertir />
              <Fila {...filaProps} label="Sueldo marketing" ars={m.costosFijos.sueldoMarketing} anterior={a?.costosFijos.sueldoMarketing} invertir />
              <Fila {...filaProps} label="Sueldos fijos" ars={m.costosFijos.sueldosFijos} anterior={a?.costosFijos.sueldosFijos} invertir />
              <Fila {...filaProps} label="Suscripciones" ars={m.costosFijos.suscripciones} anterior={a?.costosFijos.suscripciones} invertir />
              <Fila {...filaProps} label="Sueldo Thomy" ars={m.costosFijos.sueldoThomy} anterior={a?.costosFijos.sueldoThomy} invertir />
              <Fila {...filaProps} label="Costos fijos totales" ars={t.costosFijos} anterior={ta?.costosFijos} nivel={1} invertir />

              <Fila {...filaProps} label="Extras" ars={m.extras} anterior={a?.extras} nivel={1} invertir />
              <Fila {...filaProps} label="EBITDA" ars={t.ebitda} anterior={ta?.ebitda} nivel={1} />
              <Fila {...filaProps} label="Impuestos" ars={m.impuestos} anterior={a?.impuestos} invertir />
              <Fila {...filaProps} label="Fees" ars={m.fees} anterior={a?.fees} invertir />
              <Fila {...filaProps} label="Utilidad neta" ars={t.utilidadNeta} anterior={ta?.utilidadNeta} nivel={2} />
            </tbody>
          </table>

          {/* Mezcla del margen */}
          <section>
            <h3 className="text-sm font-black uppercase tracking-tight">
              Mezcla del margen<span className="text-accent">.</span>
            </h3>
            <p className="text-xs text-zinc-500">
              Cada costo operativo como % de los ingresos{a ? `, contra ${MESES[a.mes - 1].toLowerCase()}` : ""}.
              {m.margenSinWebs !== null && (
                <>
                  {" "}
                  Margen sin webs: <b className="text-ink">{fmtPct(m.margenSinWebs)}</b>.
                </>
              )}
            </p>
            <div className="mt-2 flex gap-4 text-[11px] text-zinc-500">
              <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-white/70" />{MESES[m.mes - 1]}</span>
              {a && <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-[#a9a8a8]" />{MESES[a.mes - 1]}</span>}
            </div>
            <ul className="mt-3 space-y-2.5">
              {mezcla.map((x, i) => (
                <li key={x.k} className="grid grid-cols-[8.5rem_1fr_3.5rem] items-center gap-3" title={`${x.k}: ${fmtPct(x.p)}${x.pa !== null ? ` (antes ${fmtPct(x.pa)})` : ""}`}>
                  <span className="truncate text-xs text-zinc-600">{x.k}</span>
                  <span className="space-y-[2px]">
                    <motion.span className="block h-3 rounded-r-[4px] bg-white/70" initial={{ width: 0 }} animate={{ width: `${(x.p / maxP) * 100}%` }} transition={{ delay: 0.1 + i * 0.05, duration: 0.4, ease }} />
                    {x.pa !== null && (
                      <motion.span className="block h-2 rounded-r-[4px] bg-[#a9a8a8]" initial={{ width: 0 }} animate={{ width: `${(x.pa / maxP) * 100}%` }} transition={{ delay: 0.15 + i * 0.05, duration: 0.4, ease }} />
                    )}
                  </span>
                  <span className="text-right text-xs font-bold tabular-nums">{fmtPct(x.p)}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Recurrencias y clientes */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-200 p-4">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Recurrencias</h3>
              <dl className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between"><dt className="text-zinc-500">ARS</dt><dd className="tabular-nums">{fmtARS(m.recurrencias.ars)}</dd></div>
                <div className="flex justify-between"><dt className="text-zinc-500">EUR (en ARS)</dt><dd className="tabular-nums">{fmtARS(m.recurrencias.eurEnArs)}</dd></div>
                <div className="flex justify-between font-bold"><dt>Total</dt><dd className="tabular-nums">{moneda === "USD" ? fmtUSD(t.usd(t.recurrenciaTotal)) : fmtARS(t.recurrenciaTotal)}</dd></div>
                <div className="flex justify-between"><dt className="text-zinc-500">Por cliente</dt><dd className="tabular-nums">{fmtUSD(t.usd(t.recurrenciaTotal) / (m.clientes || 1))}</dd></div>
                {m.contMarginalUsd !== null && (
                  <div className="flex justify-between"><dt className="text-zinc-500">Contribución marginal</dt><dd className="tabular-nums">{fmtUSD(m.contMarginalUsd)}</dd></div>
                )}
              </dl>
            </div>
            <div className="rounded-xl border border-zinc-200 p-4">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Clientes</h3>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                {[["Clientes", m.clientes], ["Entradas", m.entradas], ["Bajas", m.bajas]].map(([k, v]) => (
                  <div key={k as string}>
                    <p className="text-2xl font-black tabular-nums">{v}</p>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-400">{k}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-zinc-500">
                Dólar usado: <b className="text-ink">{fmtNum(m.dolar)}</b> · {m.dolarFuente}
              </p>
            </div>
          </section>

          {/* Análisis */}
          {[
            ["Análisis del mes", m.analisis],
            ["Objetivos cumplidos", m.objetivos],
            ["Puntos de mejora", m.mejoras],
          ].map(([titulo, lista]) =>
            (lista as string[]).length ? (
              <section key={titulo as string}>
                <h3 className="text-sm font-black uppercase tracking-tight">
                  {titulo as string}
                  <span className="text-accent">.</span>
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {(lista as string[]).map((x) => (
                    <li key={x} className="flex gap-2 text-sm text-zinc-700">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                      {x.startsWith("(Borrador Claude)") ? (
                        <span>
                          <span className="mr-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white">Borrador Claude</span>
                          {x.replace("(Borrador Claude)", "").trim()}
                        </span>
                      ) : (
                        x
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null,
          )}

          {(m.ajustes.length > 0 || m.revisar.length > 0) && (
            <section className="rounded-xl bg-surface p-4 text-sm">
              <h3 className="font-bold">Ajustes contra el Excel</h3>
              <ul className="mt-1 list-disc pl-5 text-zinc-600">{m.ajustes.map((x) => <li key={x}>{x}</li>)}</ul>
            </section>
          )}
            </motion.div>
          )}
          <p className="text-[11px] text-zinc-400">Fuente: {m.fuente}</p>
        </div>
      </motion.aside>
    </>
  );
}

/* ---------- Q ---------- */
function TarjetaQ({ q, ag, onClick, i, moneda }: { q: number; ag: Agregado | null; onClick: () => void; i: number; moneda: Moneda }) {
  return (
    <motion.button
      layoutId={`q-${q}`}
      onClick={onClick}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + i * 0.07, duration: 0.35, ease }}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      className={`flex aspect-square w-full flex-col rounded-2xl p-4 text-left ${ag ? "bg-ink text-white" : "border border-dashed border-zinc-300 bg-white text-zinc-400"}`}
    >
      <motion.p layoutId={`q-titulo-${q}`} className="text-2xl font-black">
        Q{q}
        <span className="text-accent">.</span>
      </motion.p>
      {ag ? (
        <>
          <p className="mt-auto text-[10px] uppercase tracking-wider text-white/50">Utilidad neta</p>
          <p className="text-xl font-black tabular-nums text-accent sm:text-2xl">{moneda === "USD" ? fmtUSD(ag.utilidadUsd) : fmtARS(ag.utilidad)}</p>
          <p className="text-xs text-white/60">
            Margen {fmtPct(ag.margenPct)} · {ag.meses}/3 meses
          </p>
          <div className="mt-2 text-accent">
            <MiniTendencia valores={ag.tendenciaUtilidadUsd} />
          </div>
        </>
      ) : (
        <p className="mt-auto text-xs">Sin datos todavía</p>
      )}
    </motion.button>
  );
}

function QExpandido({ q, anio, lista, anterior, pendiente, moneda, onClose, onMes, onPendiente, anteriorDe }: {
  q: number; anio: number; lista: MesER[]; anterior: Agregado | null; pendiente: Pendiente; moneda: Moneda;
  onClose: () => void; onMes: (m: MesER) => void; onPendiente: () => void; anteriorDe: (m: MesER) => MesER | undefined;
}) {
  const ag = agregar(lista);
  const mesesQ = [1, 2, 3].map((k) => (q - 1) * 3 + k);
  // Promedio mensual: así un Q en curso (1 o 2 meses) se compara de forma justa con uno completo.
  const prom = (a: Agregado | null, f: (x: Agregado) => number) => (a && a.meses ? f(a) / a.meses : null);
  const comp: [string, number, number | null, boolean?][] = [
    ["Ingresos USD / mes", prom(ag, (x) => x.ingresosUsd)!, prom(anterior, (x) => x.ingresosUsd)],
    ["Utilidad USD / mes", prom(ag, (x) => x.utilidadUsd)!, prom(anterior, (x) => x.utilidadUsd)],
    ["Costos fijos / mes", prom(ag, (x) => x.costosFijos)!, prom(anterior, (x) => x.costosFijos), true],
    ["Extras / mes", prom(ag, (x) => x.extras)!, prom(anterior, (x) => x.extras), true],
  ];
  return (
    <motion.section layoutId={`q-${q}`} className="rounded-3xl bg-ink p-5 text-white md:p-7" transition={{ duration: 0.4, ease }}>
      <div className="flex items-start justify-between gap-3">
        <motion.h2 layoutId={`q-titulo-${q}`} className="text-3xl font-black">
          Q{q} {anio}
          <span className="text-accent">.</span>
        </motion.h2>
        <button onClick={onClose} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold hover:bg-white/20">
          ← Todos los Q
        </button>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.3 }}>
        {/* Meses */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {mesesQ.map((mes, i) => {
            const m = lista.find((x) => x.mes === mes);
            if (m) return <TarjetaMes key={mes} m={m} anterior={anteriorDe(m)} moneda={moneda} onClick={() => onMes(m)} i={i} />;
            if (pendiente && pendiente.anio === anio && pendiente.mes === mes)
              return <TarjetaPendiente key={mes} mes={mes} anio={anio} atrasado={pendiente.atrasado} onClick={onPendiente} />;
            return (
              <div key={mes} className="flex min-h-20 w-full flex-col justify-end rounded-2xl border border-dashed border-white/20 p-4 text-white/40 sm:aspect-square">
                <p className="text-sm font-bold">{MESES[mes - 1]}</p>
                <p className="text-xs">Sin datos</p>
              </div>
            );
          })}
        </div>

        {/* Totales, comparación, motor */}
        {ag.meses === 0 ? (
          <p className="mt-5 rounded-2xl bg-white/[0.06] p-4 text-sm text-white/60">Todavía no hay meses consolidados en este Q.</p>
        ) : (
        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="rounded-2xl bg-white/[0.06] p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-white/50">Totales y promedios</h3>
            <dl className="mt-2 space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-white/60">Ingresos</dt><dd className="font-bold tabular-nums">{moneda === "USD" ? fmtUSD(ag.ingresosUsd) : fmtARS(ag.ingresos)}</dd></div>
              <div className="flex justify-between"><dt className="text-white/60">Utilidad neta</dt><dd className="font-bold tabular-nums text-accent">{moneda === "USD" ? fmtUSD(ag.utilidadUsd) : fmtARS(ag.utilidad)}</dd></div>
              <div className="flex justify-between"><dt className="text-white/60">Margen operativo</dt><dd className="tabular-nums">{fmtPct(ag.margenPct)}</dd></div>
              <div className="flex justify-between"><dt className="text-white/60">% utilidad</dt><dd className="tabular-nums">{fmtPct(ag.utilidadPct)}</dd></div>
              <div className="flex justify-between"><dt className="text-white/60">Promedio mensual (utilidad)</dt><dd className="tabular-nums">{fmtUSD(ag.promedioUtilidadUsd)}</dd></div>
            </dl>
          </div>
          <div className="rounded-2xl bg-white/[0.06] p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-white/50">Contra Q{q - 1 || 4} {q === 1 ? anio - 1 : anio}</h3>
            {anterior ? (
              <dl className="mt-2 space-y-1.5 text-sm">
                {comp.map(([k, v, va, inv]) => (
                  <div key={k} className="flex items-center justify-between gap-2">
                    <dt className="text-white/60">{k}</dt>
                    <dd className="flex items-center gap-2 tabular-nums">
                      {k.includes("USD") ? fmtUSD(v) : fmtARS(v)}
                      <span className="rounded bg-white px-1"><Variacion actual={v} anterior={va} invertir={inv} /></span>
                    </dd>
                  </div>
                ))}
                <p className="pt-1 text-[11px] text-white/40">
                  Promedios mensuales{ag.meses < 3 ? ` · Q en curso: ${ag.meses} de 3 meses cargados` : ""}.
                </p>
              </dl>
            ) : (
              <p className="mt-2 text-sm text-white/40">Sin datos del Q anterior.</p>
            )}
          </div>
          <div className="rounded-2xl bg-white/[0.06] p-4">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-white/50">Motor de crecimiento</h3>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              {[["Entradas", ag.entradas], ["Bajas", ag.bajas], ["Clientes", ag.clientesFinal]].map(([k, v]) => (
                <div key={k as string}>
                  <p className="text-3xl font-black tabular-nums">{v}</p>
                  <p className="text-[10px] uppercase tracking-wider text-white/50">{k}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-white/50">
              Neto del Q: <b className="text-white">{ag.entradas - ag.bajas >= 0 ? "+" : ""}{ag.entradas - ag.bajas}</b> clientes. Renovaciones y CAC todavía no se registran en el ER.
            </p>
          </div>
        </div>
        )}
      </motion.div>
    </motion.section>
  );
}

/* ---------- Página ---------- */
export function EstadoResultados({ meses, pendiente }: { meses: MesER[]; pendiente: Pendiente }) {
  const anios = useMemo(() => [...new Set([...meses.map((m) => m.anio), ...(pendiente ? [pendiente.anio] : [])])].sort(), [meses, pendiente]);
  const [anio, setAnio] = useState(anios.at(-1) ?? new Date().getFullYear());
  const [moneda, setMoneda] = useState<Moneda>("USD");
  const [qAbierto, setQAbierto] = useState<number | null>(null);
  const [mesAbierto, setMesAbierto] = useState<MesER | null>(null);
  // El mes a consolidar se fija al abrir el modal (al guardar, el "próximo" cambia).
  const [modal, setModal] = useState<{ anio: number; mes: number } | null>(null);

  const delAnio = meses.filter((m) => m.anio === anio).sort((a, b) => a.mes - b.mes);
  const ag = agregar(delAnio);
  const porQ = (q: number, a = anio) => meses.filter((m) => m.anio === a && trimestreDe(m.mes) === q).sort((x, y) => x.mes - y.mes);
  const agQ = (q: number, a = anio) => (porQ(q, a).length ? agregar(porQ(q, a)) : null);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (mesAbierto) setMesAbierto(null);
      else if (modal) setModal(null);
      else setQAbierto(null);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [mesAbierto, modal]);

  const ultimo = [...meses].sort((a, b) => a.anio - b.anio || a.mes - b.mes).at(-1);
  const objetivo = pendiente ?? (ultimo ? (ultimo.mes === 12 ? { anio: ultimo.anio + 1, mes: 1 } : { anio: ultimo.anio, mes: ultimo.mes + 1 }) : null);
  const anteriorDe = (m: Pick<MesER, "anio" | "mes">) => meses.find((x) => (m.mes === 1 ? x.anio === m.anio - 1 && x.mes === 12 : x.anio === m.anio && x.mes === m.mes - 1));

  return (
    <MotionConfig reducedMotion="user">
      <div className="mx-auto max-w-6xl">
        <motion.header initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease }} className="mb-6 flex flex-wrap items-end gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-400">
              Finanzas
              {pendiente && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-white">{pendiente.atrasado ? "Consolidación atrasada" : "Consolidación pendiente"}</span>}
            </p>
            <h1 className="mt-1 text-3xl font-black uppercase tracking-tight">
              Estado de <span className="font-extralight">Resultados</span>
              <span className="text-accent">.</span>
            </h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {objetivo && (
              <motion.button
                onClick={() => objetivo && setModal(objetivo)}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold text-white ${pendiente ? "bg-accent" : "bg-ink"}`}
                title={`Consolidar ${MESES[objetivo.mes - 1]} ${objetivo.anio}`}
              >
                <span className="text-lg leading-none">+</span> Consolidar {MESES[objetivo.mes - 1].toLowerCase()}
              </motion.button>
            )}
            <select value={anio} onChange={(e) => { setAnio(Number(e.target.value)); setQAbierto(null); }} className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm font-bold">
              {anios.map((a) => <option key={a}>{a}</option>)}
            </select>
            <div className="inline-flex rounded-full bg-surface p-1">
              {(["USD", "ARS"] as const).map((x) => (
                <button key={x} onClick={() => setMoneda(x)} className="relative rounded-full px-3 py-1 text-xs font-bold">
                  {moneda === x && <motion.span layoutId="moneda" className="absolute inset-0 rounded-full bg-ink" transition={{ duration: 0.25, ease }} />}
                  <span className={`relative ${moneda === x ? "text-white" : "text-zinc-500"}`}>{x}</span>
                </button>
              ))}
            </div>
          </div>
        </motion.header>

        {/* Resumen del año */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ["Ingresos brutos", moneda === "USD" ? ag.ingresosUsd : ag.ingresos, moneda === "USD" ? fmtUSD : fmtARS, `${ag.meses} meses`],
            ["Margen operativo", ag.margenPct, fmtPct, "sobre ingresos"],
            ["Utilidad neta", moneda === "USD" ? ag.utilidadUsd : ag.utilidad, moneda === "USD" ? fmtUSD : fmtARS, `${fmtPct(ag.utilidadPct)} de ingresos`],
            ["Clientes", ag.clientesFinal, fmtNum, `+${ag.entradas} / −${ag.bajas} en el año`],
          ].map(([k, v, f, nota], i) => (
            <motion.div
              key={k as string}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.35, ease }}
              className="rounded-2xl border border-zinc-200 bg-white p-4"
            >
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">{k as string}</p>
              <p className="mt-1 text-2xl font-black tabular-nums text-accent md:text-3xl">
                <Cuenta valor={v as number} formato={f as (n: number) => string} />
              </p>
              <p className="text-xs text-zinc-500">{nota as string}</p>
            </motion.div>
          ))}
        </div>

        {/* Trimestres */}
        <div className="mt-6">
          <LayoutGroup>
            <AnimatePresence mode="popLayout" initial={false}>
              {qAbierto === null ? (
                <motion.div key="grilla" className="grid grid-cols-2 gap-3 md:grid-cols-4" exit={{ opacity: 0 }}>
                  {[1, 2, 3, 4].map((q, i) => (
                    <TarjetaQ key={q} q={q} ag={agQ(q)} moneda={moneda} i={i} onClick={() => setQAbierto(q)} />
                  ))}
                </motion.div>
              ) : (
                <QExpandido
                  key={`q${qAbierto}`}
                  q={qAbierto}
                  anio={anio}
                  lista={porQ(qAbierto)}
                  anterior={qAbierto === 1 ? agQ(4, anio - 1) : agQ(qAbierto - 1)}
                  pendiente={pendiente}
                  moneda={moneda}
                  onClose={() => setQAbierto(null)}
                  onMes={setMesAbierto}
                  onPendiente={() => pendiente && setModal({ anio: pendiente.anio, mes: pendiente.mes })}
                  anteriorDe={anteriorDe}
                />
              )}
            </AnimatePresence>
          </LayoutGroup>
          {qAbierto === null && pendiente && pendiente.anio === anio && (
            <button onClick={() => setQAbierto(trimestreDe(pendiente.mes))} className="mt-3 text-xs font-bold text-accent hover:underline">
              {MESES[pendiente.mes - 1]} está pendiente de consolidar → abrir Q{trimestreDe(pendiente.mes)}
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {mesAbierto && <DetalleMes key={`${mesAbierto.anio}-${mesAbierto.mes}`} m={mesAbierto} anterior={anteriorDe(mesAbierto)} moneda={moneda} setMoneda={setMoneda} onClose={() => setMesAbierto(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {modal && (
          <Consolidar
            anio={modal.anio}
            mes={modal.mes}
            clientesMesAnterior={anteriorDe(modal)?.clientes ?? null}
            onClose={() => setModal(null)}
          />
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}

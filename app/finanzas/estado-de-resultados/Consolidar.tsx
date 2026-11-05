"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { MESES } from "@/lib/finanzas";
import { CFI, COP, ING, LINEAS, OTROS, calcularER, type Ajustes } from "@/lib/er/motor";
import { claveItem, control, fuenteUrlDe, itemsRevisar, validarConfirmacion, type Resoluciones } from "@/lib/er/mes";
import { confirmarMes, prepararBorrador, type Borrador } from "./actions";

const ease = [0.22, 1, 0.36, 1] as const;
const ars = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
const usd = (n: number) => "USD " + new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n);
const pct = (n: number) => new Intl.NumberFormat("es-AR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);

const PASOS = ["Leyendo la hoja BALANCE y el bloque del mes", "Trayendo Nómina, Clientes y Vencimientos de Notion", "Tomando el dólar blue del día", "Ejecutando la skill (er_mes)"];

function Ejecutando() {
  const [paso, setPaso] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPaso((p) => Math.min(p + 1, PASOS.length - 1)), 1100);
    return () => clearInterval(t);
  }, []);
  return (
    <ul className="space-y-3 py-4">
      {PASOS.map((p, i) => (
        <motion.li key={p} initial={{ opacity: 0, x: -8 }} animate={{ opacity: i <= paso ? 1 : 0.35, x: 0 }} transition={{ delay: i * 0.08 }} className="flex items-center gap-3 text-sm">
          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${i < paso ? "bg-ink text-white" : i === paso ? "bg-accent text-white" : "bg-surface text-zinc-400"}`}>
            {i < paso ? "✓" : i + 1}
          </span>
          {p}
          {i === paso && <motion.span className="h-1.5 w-1.5 rounded-full bg-accent" animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 0.9, repeat: Infinity }} />}
        </motion.li>
      ))}
    </ul>
  );
}

export function Consolidar({ anio, mes, clientesMesAnterior, onClose }: { anio: number; mes: number; clientesMesAnterior: number | null; onClose: () => void }) {
  const router = useRouter();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ajustes, setAjustes] = useState<Ajustes>({ filas: {} });
  const [res, setRes] = useState<Resoluciones>({});
  const [expl, setExpl] = useState<{ concepto: string; monto: number }[]>([]);
  const [nueva, setNueva] = useState({ concepto: "", monto: "" });
  const [listo, setListo] = useState<number | null>(null);
  const [cargando, iniciar] = useTransition();

  const er = useMemo(() => (borrador ? calcularER(borrador.bloques, borrador.idx, borrador.roles, borrador.clientes, ajustes) : null), [borrador, ajustes]);
  const items = er ? itemsRevisar(er) : [];
  const ctrl = er ? control(er, expl) : null;
  const motivo = er ? validarConfirmacion(er, res, expl) : "Falta el borrador";

  const ejecutar = () => {
    if (!archivo) return;
    setError(null);
    const fd = new FormData();
    fd.set("archivo", archivo);
    fd.set("anio", String(anio));
    fd.set("mes", String(mes));
    iniciar(async () => {
      const r = await prepararBorrador(fd);
      if (r.ok) setBorrador(r.data);
      else setError(r.error);
    });
  };
  const confirmar = () => {
    if (!borrador) return;
    setError(null);
    iniciar(async () => {
      const r = await confirmarMes(borrador, ajustes, res, expl);
      if (r.ok) {
        setListo(r.data.version);
        setTimeout(() => {
          router.refresh();
          onClose();
        }, 1800);
      } else setError(r.error);
    });
  };
  const elegirLinea = (fila: number | "+", k: string, linea: string) => {
    if (fila !== "+") setAjustes((a) => ({ ...a, filas: { ...a.filas, [String(fila)]: linea } }));
    setRes((r) => ({ ...r, [k]: { linea, confirmado: r[k]?.confirmado ?? false } }));
  };

  const m = borrador?.metricas;
  const chequeoClientes = m && clientesMesAnterior !== null ? clientesMesAnterior + m.entradas.length - m.bajas.length : null;

  return (
    <>
      <motion.div className="fixed inset-0 z-40 bg-ink/50 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !cargando && onClose()} />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ duration: 0.3, ease }}
        className={`fixed inset-x-3 top-6 bottom-6 z-50 mx-auto overflow-y-auto rounded-3xl bg-white shadow-2xl ${borrador ? "max-w-4xl" : "max-w-lg sm:top-1/4 sm:bottom-auto"}`}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-zinc-100 bg-white px-6 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-zinc-400">{borrador ? "Borrador · revisión" : "Consolidar mes"}</p>
            <h2 className="text-xl font-black uppercase tracking-tight">
              {MESES[mes - 1]} {anio}
              <span className="text-accent">.</span>
            </h2>
          </div>
          {!cargando && (
            <button onClick={onClose} aria-label="Cerrar" className="text-2xl leading-none text-zinc-400 hover:text-ink">
              ×
            </button>
          )}
        </header>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {listo !== null ? (
              <motion.div key="listo" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-10 text-center">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16 }} className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-ink text-4xl text-white">
                  ✓
                </motion.div>
                <p className="mt-4 text-lg font-black uppercase">
                  {MESES[mes - 1]} consolidado<span className="text-accent">.</span>
                </p>
                <p className="text-sm text-zinc-500">Versión {listo} guardada. La alerta se apaga.</p>
              </motion.div>
            ) : !borrador ? (
              <motion.div key="subir" exit={{ opacity: 0 }}>
                {cargando ? (
                  <Ejecutando />
                ) : (
                  <>
                    <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 px-4 py-10 text-center hover:border-ink">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-2xl text-white">+</span>
                      <span className="mt-3 text-sm font-bold">{archivo ? archivo.name : "Subí el Excel de Yourebrand"}</span>
                      <span className="text-xs text-zinc-500">.xlsx con la hoja BALANCE (y PAGOS)</span>
                      <input type="file" accept=".xlsx" className="hidden" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
                    </label>
                    <button disabled={!archivo} onClick={ejecutar} className="mt-4 w-full rounded-full bg-ink py-3 text-sm font-bold text-white disabled:opacity-40">
                      Ejecutar la skill
                    </button>
                  </>
                )}
              </motion.div>
            ) : (
              er &&
              ctrl &&
              m && (
                <motion.div key="revision" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  {/* KPIs */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      ["Ingresos brutos", ars(er.ingresos_brutos)],
                      ["Margen operativo", pct(er.margen_operativo / er.ingresos_brutos)],
                      ["Utilidad neta", ars(er.utilidad_neta)],
                      ["En USD", usd(er.utilidad_neta / borrador.dolar.valor)],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded-xl bg-surface p-3">
                        <p className="text-[10px] uppercase tracking-wider text-zinc-400">{k}</p>
                        <p className="mt-1 text-lg font-black tabular-nums text-accent">{v}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-zinc-500">
                    Dólar: <b className="text-ink">{borrador.dolar.valor.toLocaleString("es-AR")}</b> · {borrador.dolar.fuente} · Euro del Excel {er.euro.toLocaleString("es-AR")} · Archivo {borrador.archivo}
                  </p>

                  {/* REVISAR */}
                  <section>
                    <h3 className="text-sm font-black uppercase tracking-tight">
                      Revisar <span className="ml-1 rounded-full bg-accent px-2 py-0.5 text-[11px] text-white">{items.filter((d) => !res[claveItem(d)]?.confirmado).length}</span>
                    </h3>
                    <p className="text-xs text-zinc-500">Lo que la skill marcó para decidir vos. Elegí la línea y confirmá cada uno: el ER se recalcula al instante.</p>
                    <ul className="mt-3 space-y-2">
                      {items.map((d) => {
                        const k = claveItem(d);
                        const ok = res[k]?.confirmado;
                        return (
                          <li key={k} className={`rounded-xl border p-3 ${ok ? "border-zinc-200 bg-surface" : "border-accent/50"}`}>
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                              <span className="rounded bg-ink px-1.5 text-[11px] font-bold text-white">F{d.fila}</span>
                              <b>{d.nombre}</b>
                              <span className="tabular-nums text-zinc-600">{ars(d.monto)}</span>
                              <span className="text-xs text-zinc-500">· {d.tipo}</span>
                            </div>
                            <p className="mt-1 text-xs text-zinc-600">{d.nota}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <select
                                value={res[k]?.linea ?? d.linea}
                                disabled={d.fila === "+"}
                                onChange={(e) => elegirLinea(d.fila, k, e.target.value)}
                                className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs"
                              >
                                {LINEAS.map((l) => (
                                  <option key={l}>{l}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => setRes((r) => ({ ...r, [k]: { linea: r[k]?.linea ?? d.linea, confirmado: !ok } }))}
                                className={`rounded-full px-3 py-1.5 text-xs font-bold ${ok ? "bg-ink text-white" : "border border-ink"}`}
                              >
                                {ok ? "✓ Confirmado" : "Confirmar"}
                              </button>
                            </div>
                          </li>
                        );
                      })}
                      {!items.length && <li className="text-sm text-zinc-500">Nada para revisar.</li>}
                    </ul>
                  </section>

                  {/* Control */}
                  <section className="rounded-2xl border border-zinc-200 p-4">
                    <h3 className="text-sm font-black uppercase tracking-tight">
                      Control contra el Excel<span className="text-accent">.</span>
                    </h3>
                    {ctrl.excel === null ? (
                      <p className="mt-1 text-sm text-zinc-500">El bloque no tiene la fila «Calculo diferido».</p>
                    ) : (
                      <>
                        <dl className="mt-2 grid grid-cols-2 gap-1 text-sm sm:grid-cols-4">
                          <div><dt className="text-[10px] uppercase text-zinc-400">Calculo diferido</dt><dd className="tabular-nums">{ars(ctrl.excel)}</dd></div>
                          <div><dt className="text-[10px] uppercase text-zinc-400">Utilidad ER</dt><dd className="tabular-nums">{ars(er.utilidad_neta)}</dd></div>
                          <div><dt className="text-[10px] uppercase text-zinc-400">Diferencia</dt><dd className="tabular-nums">{ars(ctrl.dif)}</dd></div>
                          <div>
                            <dt className="text-[10px] uppercase text-zinc-400">Sin explicar</dt>
                            <dd className={`font-bold tabular-nums ${Math.abs(ctrl.sinExplicar) <= 2 ? "text-emerald-600" : "text-red-600"}`}>{ars(ctrl.sinExplicar)}</dd>
                          </div>
                        </dl>
                        <ul className="mt-3 space-y-1 text-xs text-zinc-600">
                          {[...er.explicado, ...expl].map((x, i) => (
                            <li key={i} className="flex justify-between gap-3">
                              <span>{x.concepto}</span>
                              <span className="tabular-nums">{ars(x.monto)}</span>
                            </li>
                          ))}
                        </ul>
                        {Math.abs(ctrl.sinExplicar) > 2 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <input value={nueva.concepto} onChange={(e) => setNueva({ ...nueva, concepto: e.target.value })} placeholder="Qué explica la diferencia (ej. redondeo de cuotas)" className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-2 py-1.5 text-xs" />
                            <input value={nueva.monto} onChange={(e) => setNueva({ ...nueva, monto: e.target.value })} placeholder="Monto" inputMode="numeric" className="w-28 rounded-lg border border-zinc-200 px-2 py-1.5 text-xs" />
                            <button
                              onClick={() => {
                                const monto = Number(nueva.monto.replace(/\./g, "").replace(",", "."));
                                if (nueva.concepto && Number.isFinite(monto)) setExpl((x) => [...x, { concepto: nueva.concepto, monto }]);
                                setNueva({ concepto: "", monto: "" });
                              }}
                              className="rounded-full border border-ink px-3 py-1.5 text-xs font-bold"
                            >
                              Agregar explicación
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </section>

                  {/* Clientes */}
                  <section className="rounded-2xl border border-zinc-200 p-4 text-sm">
                    <h3 className="text-sm font-black uppercase tracking-tight">
                      Clientes, entradas y bajas<span className="text-accent">.</span>
                    </h3>
                    <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <p className="text-2xl font-black">{m.clientes}</p>
                        <p className="text-[10px] uppercase text-zinc-400">Clientes con abono a fin de mes</p>
                        {chequeoClientes !== null && (
                          <p className={`mt-1 text-xs ${chequeoClientes === m.clientes ? "text-emerald-600" : "text-red-600"}`}>
                            Mes anterior {clientesMesAnterior} + {m.entradas.length} − {m.bajas.length} = {chequeoClientes}
                            {chequeoClientes === m.clientes ? " ✓" : " · no cierra, revisalo"}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-2xl font-black">{m.entradas.length}</p>
                        <p className="text-[10px] uppercase text-zinc-400">Entradas (Desde en el mes) · Excel: {String(er.nuevosExcel ?? "—")}</p>
                        <p className="mt-1 text-xs text-zinc-500">{m.entradas.join(", ") || "—"}</p>
                      </div>
                      <div>
                        <p className="text-2xl font-black">{m.bajas.length}</p>
                        <p className="text-[10px] uppercase text-zinc-400">Bajas (Notion) · Excel: {String(er.bajasExcel ?? "—")}</p>
                        <p className="mt-1 text-xs text-zinc-500">{m.bajas.join(", ") || "—"}</p>
                        {m.bajasVencimientos === null && <p className="mt-1 text-[11px] text-zinc-400">Sin acceso a «Vencimientos del mes»: se usó Fecha de baja de Clientes.</p>}
                      </div>
                    </div>
                    {m.sinPrecio.length > 0 && <p className="mt-2 text-xs text-red-600">Sin precio cargado en Notion (no entran en recurrencias): {m.sinPrecio.join(", ")}.</p>}
                  </section>

                  {/* ER armado */}
                  <section>
                    <h3 className="text-sm font-black uppercase tracking-tight">
                      ER armado<span className="text-accent">.</span>
                    </h3>
                    <div className="mt-2 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                      {[ING, COP, CFI, OTROS].map((grupo, gi) => (
                        <dl key={gi} className="mt-2 space-y-1 text-sm">
                          {grupo.map((l) => (
                            <div key={l} className="flex justify-between gap-3 border-b border-zinc-100 py-0.5">
                              <dt className="text-zinc-600">{l}</dt>
                              <dd className="tabular-nums">{ars(er.lineas[l])}</dd>
                            </div>
                          ))}
                        </dl>
                      ))}
                    </div>
                  </section>

                  <p className="rounded-xl bg-surface p-3 text-xs text-zinc-600">
                    Google Sheets: para esta prueba se usa la pestaña existente{" "}
                    <a href={fuenteUrlDe(anio, mes)} target="_blank" rel="noreferrer" className="font-bold underline">
                      «{MESES[mes - 1]} {String(anio).slice(2)}» ↗
                    </a>
                    . La escritura automática en la planilla necesita conectar una cuenta de Google al servidor.
                  </p>
                </motion.div>
              )
            )}
          </AnimatePresence>

          {error && <p className="mt-4 rounded-xl bg-accent-soft/60 p-3 text-sm">{error}</p>}
        </div>

        {borrador && listo === null && (
          <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 bg-white px-6 py-4">
            <p className="text-xs text-zinc-500">{motivo ?? "Todo resuelto: listo para consolidar."}</p>
            <button disabled={!!motivo || cargando} onClick={confirmar} className="rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40">
              {cargando ? "Guardando…" : "Confirmar y consolidar"}
            </button>
          </footer>
        )}
      </motion.div>
    </>
  );
}

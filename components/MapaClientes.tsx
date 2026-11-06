"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import createGlobe from "cobe";
import { useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { Logo } from "@/components/Logo";
import { porEntrada, type Cliente } from "@/lib/clientes";
import type { Caso } from "@/lib/equipo";
import { ENCUADRES, PAISES, SEDE, angulos, esAMBA, ubicar } from "@/lib/geo";
import type { PuntoCliente } from "@/components/MapaZoom";

const ease = [0.22, 1, 0.36, 1] as const;
const ROJO: [number, number, number] = [211 / 255, 8 / 255, 5 / 255];

function Contador({ valor }: { valor: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const desde = Number(el.textContent) || 0;
    const c = animate(desde, valor, { duration: 0.8, ease, onUpdate: (v) => (el.textContent = String(Math.round(v))) });
    return () => c.stop();
  }, [valor]);
  return <span ref={ref}>0</span>;
}

function Globo({ paises, foco }: { paises: [string, number][]; foco: string | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const objetivo = useRef<[number, number] | null>(null);
  const arrastre = useRef<{ x: number; y: number } | null>(null);
  const delta = useRef({ phi: 0, theta: 0 });

  useEffect(() => {
    const f = foco ? PAISES[foco] : null;
    objetivo.current = f ? angulos(f.lat, f.lng) : null;
  }, [foco]);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    let width = el.offsetWidth;
    let phi = angulos(SEDE.lat, SEDE.lng)[0];
    let theta = Math.max(-0.9, Math.min(0.9, angulos(SEDE.lat, SEDE.lng)[1]));
    let raf = 0;

    const markers = paises.map(([p, n]) => ({
      location: [PAISES[p].lat, PAISES[p].lng] as [number, number],
      size: 0.04 + Math.min(n, 30) * 0.004,
      id: p,
    }));
    const arcs = paises
      .filter(([p]) => PAISES[p] !== SEDE)
      .map(([p]) => ({ from: [SEDE.lat, SEDE.lng] as [number, number], to: [PAISES[p].lat, PAISES[p].lng] as [number, number] }));

    const globe = createGlobe(el, {
      devicePixelRatio: Math.min(window.devicePixelRatio, 2),
      width: width * 2,
      height: width * 2,
      phi,
      theta,
      dark: 1,
      diffuse: 1.4,
      mapSamples: 20000,
      mapBrightness: 5,
      mapBaseBrightness: 0.02,
      baseColor: [0.22, 0.21, 0.21],
      markerColor: ROJO,
      glowColor: [0.25, 0.24, 0.24],
      markers,
      arcs,
      arcColor: ROJO,
      arcWidth: 0.6,
      arcHeight: 0.35,
      markerElevation: 0.02,
      opacity: 0.95,
    });

    const loop = () => {
      const o = objetivo.current;
      if (arrastre.current) {
        // el usuario está girando el globo
      } else if (o) {
        // giro suave hacia el país elegido por el camino más corto
        let d = (o[0] - phi) % (Math.PI * 2);
        if (d > Math.PI) d -= Math.PI * 2;
        if (d < -Math.PI) d += Math.PI * 2;
        phi += d * 0.06;
        theta += (Math.max(-0.9, Math.min(0.9, o[1])) - theta) * 0.06;
      } else {
        // en reposo mira a Argentina, donde están casi todos los clientes
        const [ap, at] = angulos(SEDE.lat, SEDE.lng);
        let d = (ap - phi) % (Math.PI * 2);
        if (d > Math.PI) d -= Math.PI * 2;
        if (d < -Math.PI) d += Math.PI * 2;
        phi += d * 0.04;
        theta += (Math.max(-0.9, Math.min(0.9, at)) - theta) * 0.04;
      }
      globe.update({
        phi: phi + delta.current.phi,
        theta: Math.max(-1, Math.min(1, theta + delta.current.theta)),
        width: width * 2,
        height: width * 2,
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onResize = () => (width = el.offsetWidth);
    window.addEventListener("resize", onResize);

    // arrastrar para girar
    const down = (e: PointerEvent) => {
      arrastre.current = { x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
      el.style.cursor = "grabbing";
    };
    const move = (e: PointerEvent) => {
      if (!arrastre.current) return;
      delta.current = { phi: (e.clientX - arrastre.current.x) / 180, theta: (e.clientY - arrastre.current.y) / 300 };
    };
    const up = () => {
      if (!arrastre.current) return;
      phi += delta.current.phi;
      theta += delta.current.theta;
      delta.current = { phi: 0, theta: 0 };
      arrastre.current = null;
      el.style.cursor = "grab";
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);

    return () => {
      cancelAnimationFrame(raf);
      globe.destroy();
      window.removeEventListener("resize", onResize);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [paises]);

  return (
    <motion.div
      className="relative mx-auto aspect-square w-full max-w-[640px]"
      initial={{ opacity: 0, scale: 0.85, rotate: -8 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={{ duration: 1.4, ease }}
    >
      <div className="pointer-events-none absolute inset-[12%] rounded-full bg-accent/10 blur-3xl" />
      <canvas ref={canvas} className="relative h-full w-full cursor-grab touch-none" />
    </motion.div>
  );
}

function TarjetaCliente({ c, i, casos, lugar, activo, onSeleccionar }: { c: Cliente; i: number; casos: number; lugar?: string; activo?: boolean; onSeleccionar?: () => void }) {
  // inclinación 3D siguiendo el mouse
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rx = useSpring(useTransform(y, [-0.5, 0.5], [8, -8]), { stiffness: 200, damping: 18 });
  const ry = useSpring(useTransform(x, [-0.5, 0.5], [-8, 8]), { stiffness: 200, damping: 18 });
  const clase = `flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${
    activo ? "border-accent bg-white/[0.09]" : "border-white/10 bg-white/[0.04] hover:border-accent/60 hover:bg-white/[0.07]"
  }`;
  const contenido = (
    <>
      <Logo cliente={c} size={38} casos={casos} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{c.nombre}</p>
        <p className="truncate text-[11px] text-white/45">{lugar ?? (c.rubros.slice(0, 2).join(" · ") || "—")}</p>
      </div>
    </>
  );
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 20, rotateX: -25 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
      transition={{ delay: Math.min(i, 14) * 0.035, duration: 0.5, ease }}
      style={{ transformPerspective: 700 }}
    >
      <motion.div
        style={{ rotateX: rx, rotateY: ry, transformPerspective: 700 }}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          x.set((e.clientX - r.left) / r.width - 0.5);
          y.set((e.clientY - r.top) / r.height - 0.5);
        }}
        onMouseLeave={() => {
          x.set(0);
          y.set(0);
        }}
      >
        {onSeleccionar ? (
          <div className={clase}>
            <button onClick={onSeleccionar} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              {contenido}
            </button>
            <Link href={`/clientes/${c.id}`} className="shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold text-white/50 hover:bg-white/10 hover:text-white">
              Ficha →
            </Link>
          </div>
        ) : (
          <Link href={`/clientes/${c.id}`} className={clase}>
            {contenido}
          </Link>
        )}
      </motion.div>
    </motion.li>
  );
}

function FichaMapa({ c, lugar, casos, onClose }: { c: Cliente; lugar?: string; casos: Caso[]; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 24, scale: 0.97 }}
      transition={{ duration: 0.35, ease }}
      className="absolute inset-x-3 bottom-3 z-10 max-h-[55%] overflow-y-auto rounded-2xl bg-white p-4 text-ink shadow-2xl sm:right-auto sm:w-80"
    >
      <div className="flex items-start gap-3">
        <Logo cliente={c} size={40} casos={casos.length} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">
            {c.nombre}
            <span className="text-accent">.</span>
          </p>
          <p className="text-xs text-zinc-500">{lugar ?? c.pais}</p>
        </div>
        <button onClick={onClose} aria-label="Cerrar" className="text-xl leading-none text-zinc-400 hover:text-ink">
          ×
        </button>
      </div>
      <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Casos abiertos · {casos.length}</p>
      {casos.length ? (
        <ul className="mt-2 space-y-1.5">
          {casos.map((k) => (
            <li key={k.notionUrl}>
              <a href={k.notionUrl} target="_blank" rel="noreferrer" className="block rounded-xl border border-zinc-200 px-3 py-2 hover:border-ink">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{k.titulo}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${k.gravedad === "Leve" ? "bg-surface text-ink" : "bg-accent text-white"}`}>
                    {k.gravedad === "URGENTE" ? "Urgente" : k.gravedad}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-zinc-500">Cargado el {k.fecha.split("-").reverse().join("/")}</p>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-zinc-500">Sin casos abiertos.</p>
      )}
      <Link href={`/clientes/${c.id}`} className="mt-3 inline-block text-xs font-bold hover:text-accent">
        Ver ficha completa →
      </Link>
    </motion.div>
  );
}

const MapaZoom = dynamic(() => import("@/components/MapaZoom").then((m) => m.MapaZoom), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-white/[0.03]" />,
});

/** Encuadre que contiene todos los puntos, con un margen mínimo para que una sola ciudad se vea a nivel barrio. */
function encuadreDe(puntos: { lat: number; lng: number }[], m = 0.08): [number, number, number, number] {
  const lats = puntos.map((p) => p.lat);
  const lngs = puntos.map((p) => p.lng);
  const [s, n, o, e] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  return [o - m, s - m, e + m, n + m];
}

export type MapaHandle = { enfocar: (clienteId: string) => void };

export function MapaClientes({
  clientes,
  embebido = false,
  casos = [],
  ref,
}: {
  clientes: Cliente[];
  embebido?: boolean;
  casos?: Caso[];
  ref?: React.Ref<MapaHandle>;
}) {
  const casosDe = useMemo(() => {
    const m: Record<string, Caso[]> = {};
    for (const k of casos) if (k.cliente) (m[k.cliente] ??= []).push(k);
    return m;
  }, [casos]);
  const casosPorCliente = Object.fromEntries(Object.entries(casosDe).map(([k, v]) => [k, v.length]));
  const [pais, setPais] = useState<string | null>("Argentina");
  const [todaArgentina, setTodaArgentina] = useState(false);
  const [sel, setSel] = useState<string | null>(null);

  const paises = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of clientes) if (c.pais && PAISES[c.pais]) m.set(c.pais, (m.get(c.pais) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [clientes]);

  const elegirPais = (p: string | null) => {
    setPais(p);
    setTodaArgentina(false);
    setSel(null);
  };

  // Desde el buscador: ir al país del cliente, abrir la zona correcta y seleccionarlo.
  useImperativeHandle(ref, () => ({
    enfocar: (id) => {
      const c = clientes.find((x) => x.id === id);
      if (!c?.pais) return;
      const u = ubicar(c.ubicacion ?? [], c.pais);
      setPais(c.pais);
      setTodaArgentina(c.pais === "Argentina" && !(u?.precisa && esAMBA(u.lat, u.lng)));
      setSel(id);
    },
  }));

  // Clientes del país elegido, con coordenadas
  const ubicados = useMemo(
    () =>
      clientes
        .filter((c) => pais && c.pais === pais)
        .map((c) => ({ c, u: ubicar(c.ubicacion ?? [], c.pais) }))
        .filter((x): x is { c: Cliente; u: NonNullable<ReturnType<typeof ubicar>> } => !!x.u)
        .sort((a, b) => porEntrada(a.c, b.c)),
    [clientes, pais],
  );
  const esArg = pais === "Argentina";
  const amba = ubicados.filter((x) => x.u.precisa && esAMBA(x.u.lat, x.u.lng));
  const interior = esArg ? ubicados.filter((x) => !amba.includes(x)) : [];
  const visibles = esArg && !todaArgentina ? amba : ubicados;
  const puntos: PuntoCliente[] = visibles.map(({ c, u }) => ({ id: c.id, nombre: c.nombre, logo: c.logo, lat: u.lat, lng: u.lng, lugar: u.lugar, satisfaccion: c.satisfaccion, casos: casosPorCliente[c.id] ?? 0 }));
  const encuadre = useMemo<[number, number, number, number]>(
    () =>
      esArg
        ? todaArgentina
          ? ENCUADRES.Argentina
          : amba.length
            ? encuadreDe(amba.map((x) => x.u), 0.015) // ajustado a donde están los clientes de CABA y GBA
            : ENCUADRES.AMBA
        : (ENCUADRES[pais ?? ""] ?? (ubicados.length ? encuadreDe(ubicados.map((x) => x.u), 2.5) : ENCUADRES.Argentina)), // el país completo, con sus clientes marcados
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pais, todaArgentina, ubicados.length],
  );

  const lista = clientes.filter((c) => !pais || c.pais === pais).sort(porEntrada);
  const sinUbicacion = ubicados.filter((x) => !x.u.precisa);

  return (
    <div className={embebido ? "rounded-3xl bg-ink px-4 py-6 text-white md:px-8 md:py-8" : "-mx-4 -my-6 min-h-screen bg-ink px-4 py-8 text-white md:-mx-10 md:-my-8 md:px-10"}>
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1.15fr_1fr]">
          <div className="lg:sticky lg:top-8">
            <AnimatePresence mode="wait" initial={false}>
              {pais ? (
                <motion.div
                  key="mapa"
                  initial={{ opacity: 0, scale: 0.88, filter: "blur(8px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 0.9, filter: "blur(8px)" }}
                  transition={{ duration: 0.7, ease }}
                  className="relative h-[460px] overflow-hidden rounded-3xl border border-white/10 lg:h-[640px]"
                >
                  <MapaZoom key={pais} puntos={puntos} encuadre={encuadre} seleccionado={sel} onSeleccionar={setSel} />
                  <AnimatePresence>
                    {sel && clientes.find((c) => c.id === sel) && (
                      <FichaMapa
                        key={sel}
                        c={clientes.find((c) => c.id === sel)!}
                        lugar={ubicados.find((x) => x.c.id === sel)?.u.lugar}
                        casos={casosDe[sel] ?? []}
                        onClose={() => setSel(null)}
                      />
                    )}
                  </AnimatePresence>
                  <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-ink/80 px-3 py-1.5 text-xs font-bold backdrop-blur">
                    {PAISES[pais]?.bandera} {esArg ? (todaArgentina ? "Toda Argentina" : "CABA y Gran Buenos Aires") : pais}
                  </div>
                  <button
                    onClick={() => elegirPais(null)}
                    className="absolute right-3 top-3 rounded-full bg-ink/80 px-3 py-1.5 text-xs font-bold text-white backdrop-blur hover:bg-accent"
                  >
                    ← Volver al globo
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="globo"
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.6, filter: "blur(10px)" }}
                  transition={{ duration: 0.7, ease }}
                >
                  <Globo paises={paises} foco={null} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div>
            {!embebido && (
              <motion.header initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }} className="mb-6">
                <h1 className="text-3xl font-black uppercase tracking-tight md:text-4xl">
                  Mapa de clientes<span className="text-accent">.</span>
                </h1>
              </motion.header>
            )}
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/[0.04] p-4">
                <p className="text-4xl font-black tracking-tight text-accent">
                  <Contador valor={esArg && !todaArgentina ? amba.length : lista.length} />
                </p>
                <p className="mt-1 text-[11px] uppercase tracking-wider text-white/50">
                  {!pais ? "Clientes activos" : esArg && !todaArgentina ? "En CABA y GBA" : `Clientes en ${pais}`}
                </p>
              </div>
              <div className="rounded-2xl bg-white/[0.04] p-4">
                <p className="text-4xl font-black tracking-tight">
                  <Contador valor={pais ? lista.filter((c) => casosPorCliente[c.id]).length : paises.length} />
                </p>
                <p className="mt-1 text-[11px] uppercase tracking-wider text-white/50">{pais ? "Con casos abiertos" : "Países"}</p>
              </div>
            </div>

            {/* Filtro por país */}
            <div className="mt-6 flex flex-wrap gap-2">
              {[["Todos", clientes.length] as [string, number], ...paises].map(([p, n]) => {
                const activo = (p === "Todos" && !pais) || p === pais;
                return (
                  <button key={p} onClick={() => elegirPais(p === "Todos" ? null : p)} className="relative rounded-full px-4 py-2 text-sm font-semibold">
                    {activo && <motion.span layoutId="chip-pais" className="absolute inset-0 rounded-full bg-accent" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
                    <span className={`relative flex items-center gap-2 ${activo ? "text-white" : "text-white/60 hover:text-white"}`}>
                      {p !== "Todos" && <span>{PAISES[p].bandera}</span>}
                      {p}
                      <span className={`rounded-full px-1.5 text-[11px] ${activo ? "bg-white/20" : "bg-white/10"}`}>{n}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {!pais ? (
              <motion.ul layout className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <AnimatePresence mode="popLayout">
                  {lista.map((c, i) => (
                    <TarjetaCliente key={c.id} c={c} i={i} casos={casosPorCliente[c.id] ?? 0} />
                  ))}
                </AnimatePresence>
              </motion.ul>
            ) : (
              <>
                {esArg && (
                  <div className="mt-6 inline-flex rounded-full bg-white/[0.06] p-1">
                    {[
                      [false, `CABA y GBA · ${amba.length}`],
                      [true, `Toda Argentina · ${ubicados.length}`],
                    ].map(([v, l]) => (
                      <button
                        key={String(v)}
                        onClick={() => {
                          setTodaArgentina(v as boolean);
                          setSel(null);
                        }}
                        className="relative rounded-full px-4 py-1.5 text-xs font-bold"
                      >
                        {todaArgentina === v && <motion.span layoutId="zona-arg" className="absolute inset-0 rounded-full bg-white" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
                        <span className={`relative ${todaArgentina === v ? "text-ink" : "text-white/60"}`}>{l as string}</span>
                      </button>
                    ))}
                  </div>
                )}

                <p className="mt-5 text-[11px] font-bold uppercase tracking-wider text-white/40">
                  {esArg && !todaArgentina ? "CABA y Gran Buenos Aires" : "Clientes"} · tocá uno para verlo en el mapa
                </p>
                <motion.ul layout className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <AnimatePresence mode="popLayout">
                    {visibles.map(({ c, u }, i) => (
                      <TarjetaCliente key={c.id} c={c} i={i} casos={casosPorCliente[c.id] ?? 0} lugar={u.lugar} activo={sel === c.id} onSeleccionar={() => setSel(c.id)} />
                    ))}
                  </AnimatePresence>
                </motion.ul>

                {esArg && !todaArgentina && interior.length > 0 && (
                  <motion.aside initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, ease }} className="mt-6 rounded-2xl border border-white/10 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold">
                        Interior del país<span className="text-accent">.</span> <span className="font-normal text-white/50">{interior.length}</span>
                      </p>
                      <button onClick={() => setTodaArgentina(true)} className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-ink hover:bg-accent hover:text-white">
                        Ver toda Argentina →
                      </button>
                    </div>
                    <ul className="mt-3 space-y-1">
                      {interior.map(({ c, u }) => (
                        <li key={c.id}>
                          <button
                            onClick={() => {
                              setTodaArgentina(true);
                              setSel(c.id);
                            }}
                            className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1 text-left hover:bg-white/[0.06]"
                          >
                            <Logo cliente={c} size={26} casos={casosPorCliente[c.id] ?? 0} />
                            <span className="flex-1 truncate text-sm">{c.nombre}</span>
                            <span className="text-[11px] text-white/45">{u.precisa ? u.lugar : "Sin ubicación"}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </motion.aside>
                )}

                {sinUbicacion.length > 0 && (
                  <p className="mt-4 text-[11px] text-white/40">
                    Sin barrio/ciudad reconocido en Notion: {sinUbicacion.map((x) => x.c.nombre).join(", ")}.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

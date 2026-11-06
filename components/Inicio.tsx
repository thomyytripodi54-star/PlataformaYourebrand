"use client";

import { Suspense, use, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

export type PuntoInicio = { lat: number; lng: number };
export type Notificaciones = {
  followUp: { id: string; nombre: string; dias: number }[];
  casos: { titulo: string; cliente: string | null; gravedad: string; fecha: string }[];
};
export type ComentarioAviso = { id: string; cliente: string; autor: string; texto: string; fecha: string };
export type AreaInicio = { nombre: string; detalle: string; href: string | null; alerta?: boolean };

const ease = [0.22, 1, 0.36, 1] as const;
const ROJO = "#d30805";
const CENTRO_AR: [number, number] = [-63.8, -39.5];
const BA: [number, number] = [-58.45, -34.62];

const vacio: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/** Columna cuadrada alrededor de un punto (el lado se expresa en grados). */
function columna(p: PuntoInicio, lado: number, h: number): GeoJSON.Feature {
  const dx = lado / Math.cos((p.lat * Math.PI) / 180);
  const c = [
    [p.lng - dx, p.lat - lado],
    [p.lng + dx, p.lat - lado],
    [p.lng + dx, p.lat + lado],
    [p.lng - dx, p.lat + lado],
    [p.lng - dx, p.lat - lado],
  ];
  return { type: "Feature", properties: { h }, geometry: { type: "Polygon", coordinates: [c] } };
}

export function Inicio({
  puntos,
  areas,
  nombre,
  notificaciones,
  comentarios,
}: {
  puntos: PuntoInicio[];
  areas: AreaInicio[];
  nombre?: string;
  notificaciones: Notificaciones;
  comentarios: Promise<ComentarioAviso[]>;
}) {
  const router = useRouter();
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<maplibregl.Map | null>(null);
  const [listo, setListo] = useState(false);
  // La intro completa solo la primera vez de la sesión; al volver al menú aparece casi al instante.
  const [rapido] = useState(() => {
    try {
      return typeof window !== "undefined" && sessionStorage.getItem("yb-intro") === "1";
    } catch {
      return false;
    }
  });
  const [saliendo, setSaliendo] = useState<AreaInicio | null>(null);
  const [velo, setVelo] = useState(false);
  const fuera = useRef(false);

  useEffect(() => {
    for (const a of areas) if (a.href) router.prefetch(a.href);
  }, [areas, router]);

  useEffect(() => {
    if (!contenedor.current) return;
    const m = new maplibregl.Map({
      container: contenedor.current,
      style: {
        version: 8,
        sources: {
          mundo: { type: "geojson", data: vacio },
          provincias: { type: "geojson", data: vacio },
          columnas: { type: "geojson", data: vacio },
          puntos: { type: "geojson", data: vacio },
        },
        layers: [
          { id: "fondo", type: "background", paint: { "background-color": "#121111" } },
          { id: "mundo", type: "fill", source: "mundo", paint: { "fill-color": "#1b1a1a" } },
          { id: "mundo-borde", type: "line", source: "mundo", paint: { "line-color": "#2c2a2a", "line-width": 0.6 } },
          {
            id: "argentina",
            type: "fill-extrusion",
            source: "provincias",
            paint: { "fill-extrusion-color": "#2f2c2c", "fill-extrusion-height": 0, "fill-extrusion-height-transition": { duration: 2600, delay: 600 }, "fill-extrusion-opacity": 0.95, "fill-extrusion-vertical-gradient": true },
          },
          { id: "provincias-borde", type: "line", source: "provincias", paint: { "line-color": "#6d6868", "line-width": 0.7, "line-opacity": 0, "line-opacity-transition": { duration: 1800, delay: 1200 } } },
          { id: "halo", type: "circle", source: "puntos", paint: { "circle-color": ROJO, "circle-radius": 8, "circle-blur": 1, "circle-opacity": 0, "circle-pitch-alignment": "map" } },
          {
            id: "columnas",
            type: "fill-extrusion",
            source: "columnas",
            paint: { "fill-extrusion-color": ROJO, "fill-extrusion-base": 22000, "fill-extrusion-height": ["+", 22000, ["get", "h"]], "fill-extrusion-opacity": 0.92, "fill-extrusion-opacity-transition": { duration: 500 }, "fill-extrusion-vertical-gradient": true },
          },
        ],
      },
      center: [-62, -30],
      zoom: 1.4,
      pitch: 0,
      bearing: 0,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
      renderWorldCopies: false,
    });
    mapa.current = m;
    let vivo = true;
    let raf = 0;

    m.once("load", async () => {
      const cargar = async (n: string) => (await fetch(`/geo/${n}.geojson`)).json();
      const [mundo, provincias] = await Promise.all([cargar("mundo"), cargar("provincias")]);
      if (!vivo) return;
      (m.getSource("mundo") as maplibregl.GeoJSONSource).setData(mundo);
      (m.getSource("provincias") as maplibregl.GeoJSONSource).setData(provincias);
      (m.getSource("puntos") as maplibregl.GeoJSONSource).setData({
        type: "FeatureCollection",
        features: puntos.map((p) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [p.lng, p.lat] } })),
      });
      if (rapido) {
        m.setPaintProperty("argentina", "fill-extrusion-height-transition", { duration: 0, delay: 0 });
        m.setPaintProperty("provincias-borde", "line-opacity-transition", { duration: 300, delay: 0 });
      }
      try {
        sessionStorage.setItem("yb-intro", "1");
      } catch {}
      m.setPaintProperty("argentina", "fill-extrusion-height", 22000);
      m.setPaintProperty("provincias-borde", "line-opacity", 0.6);
      setListo(true);

      // Entrada de cámara: desde el mundo hasta Argentina en perspectiva.
      const camara = { center: CENTRO_AR, zoom: 3.6, pitch: 58, bearing: -18, padding: { top: 0, left: 0, right: m.getContainer().clientWidth >= 768 ? 420 : 0, bottom: m.getContainer().clientHeight * 0.38 } };
      if (rapido) m.jumpTo(camara);
      else m.flyTo({ center: CENTRO_AR, zoom: 3.6, pitch: 58, bearing: -18, padding: camara.padding, duration: 4200, curve: 1.2, essential: true });

      // Columnas que crecen escalonadas + pulso del halo + órbita lenta de cámara.
      const altos = puntos.map((_, i) => 70000 + ((i * 7919) % 9) * 9000);
      const inicio = performance.now() - (rapido ? 5000 : 0);
      const fuente = m.getSource("columnas") as maplibregl.GeoJSONSource;
      let crecidas = false;
      const loop = (ahora: number) => {
        if (!vivo) return;
        const t = (ahora - inicio) / 1000;
        if (!crecidas) {
          let todo = true;
          const fs = puntos.map((p, i) => {
            const k = Math.min(1, Math.max(0, (t - 2.6 - i * 0.05) / 1.1));
            if (k < 1) todo = false;
            const e = 1 - Math.pow(1 - k, 3);
            return columna(p, 0.05, altos[i] * e);
          });
          fuente.setData({ type: "FeatureCollection", features: fs });
          crecidas = todo;
        }
        const pulso = (Math.sin(t * 2.2) + 1) / 2;
        if (t > 3 && !fuera.current) {
          m.setPaintProperty("halo", "circle-radius", 10 + pulso * 12);
          m.setPaintProperty("halo", "circle-opacity", Math.min(1, (t - 3) / 1.5) * (0.25 + pulso * 0.35));
        }
        if (t > 4.4 && !fuera.current && !m.isMoving()) m.setBearing(-18 + Math.sin((t - 4.4) * 0.12) * 14);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    });

    return () => {
      vivo = false;
      cancelAnimationFrame(raf);
      m.remove();
      mapa.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entrar = (a: AreaInicio) => {
    if (!a.href || saliendo) return;
    setSaliendo(a);
    fuera.current = true;
    if (a.nombre === "Dirección")
      try {
        sessionStorage.setItem("yb-entrada-direccion", "1");
      } catch {}
    const m = mapa.current;
    // Dirección "entra al país": la cámara baja hasta Buenos Aires y se endereza.
    if (m) {
      m.setPaintProperty("columnas", "fill-extrusion-opacity", 0);
      m.setPaintProperty("halo", "circle-opacity", 0);
    }
    if (m) m.flyTo({ center: BA, padding: { top: 0, left: 0, right: 0, bottom: 0 }, zoom: a.nombre === "Dirección" ? 8.6 : 6.2, pitch: a.nombre === "Dirección" ? 0 : 70, bearing: 0, duration: 2000, curve: 1.5, essential: true });
    setTimeout(() => setVelo(true), 1350);
    setTimeout(() => router.push(a.href!), 1900);
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden bg-[#121111] text-white">
      <div className="absolute inset-0"><div ref={contenedor} className="h-full w-full" /></div>
      {/* viñeta y degradés para dar profundidad y legibilidad */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(10,9,9,0.85)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0d0c0c] via-[#0d0c0c]/70 to-transparent" />

      <AnimatePresence>
        {!saliendo && (
          <motion.header
            key="cab"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: listo ? 1 : 0, y: listo ? 0 : -16 }}
            exit={{ opacity: 0, y: -24, transition: { duration: 0.5 } }}
            transition={{ duration: rapido ? 0.5 : 1, delay: rapido ? 0 : 0.4, ease }}
            className="absolute left-6 top-6 md:left-10 md:top-8"
          >
            <p className="text-2xl font-black tracking-tight md:text-3xl">
              Yourebrand<span className="punto text-accent">.</span>
            </p>
            <p className="mt-1 text-[11px] font-extralight text-white/60">Agencia Full service de marketing digital.</p>
          </motion.header>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!saliendo && listo && (
          <motion.aside
            key="notif"
            initial={{ opacity: 0, x: 40, filter: "blur(8px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, x: 40, filter: "blur(8px)", transition: { duration: 0.5 } }}
            transition={{ duration: rapido ? 0.6 : 1, delay: rapido ? 0.15 : 3.4, ease }}
            className="absolute bottom-8 right-10 top-8 hidden w-[380px] md:block"
          >
            <Suspense fallback={<PanelNotificaciones n={notificaciones} comentarios={null} />}>
              <PanelConComentarios n={notificaciones} promesa={comentarios} />
            </Suspense>
          </motion.aside>
        )}
      </AnimatePresence>

      <div className="absolute inset-x-0 bottom-0 px-4 pb-8 md:right-[440px] md:px-10 md:pb-12" style={{ perspective: 1400 }}>
        <AnimatePresence>
          {!saliendo && (
            <motion.div key="titulo" exit={{ opacity: 0, y: 20, filter: "blur(6px)", transition: { duration: 0.5 } }}>
              <motion.p
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: listo ? 1 : 0, y: listo ? 0 : 24 }}
                transition={{ duration: rapido ? 0.6 : 1.1, delay: rapido ? 0.05 : 2.6, ease }}
                className="mb-5 text-3xl font-extralight tracking-tight md:text-5xl"
              >
                {nombre ? <>Hola, <span className="font-black">{nombre}</span>.</> : "Bienvenido."}{" "}
                <span className="block text-sm font-normal text-white/50 md:mt-2 md:text-base">
                  {puntos.length} clientes en Argentina. ¿A qué área querés entrar?
                </span>
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 2xl:grid-cols-5">
          {areas.map((a, i) => {
            const elegido = saliendo?.nombre === a.nombre;
            return (
              <motion.button
                key={a.nombre}
                type="button"
                onClick={() => entrar(a)}
                disabled={!a.href}
                initial={{ opacity: 0, y: 60, rotateX: 35, filter: "blur(10px)" }}
                animate={
                  saliendo
                    ? elegido
                      ? { opacity: 0, y: -40, scale: 1.15, rotateX: 0, filter: "blur(4px)", transition: { duration: 0.9, delay: 0.25, ease } }
                      : { opacity: 0, y: 80, rotateX: 40, filter: "blur(10px)", transition: { duration: 0.6, delay: i * 0.04, ease } }
                    : listo
                      ? { opacity: 1, y: 0, rotateX: 0, filter: "blur(0px)", transition: { duration: rapido ? 0.6 : 1, delay: rapido ? 0.1 + i * 0.05 : 3 + i * 0.11, ease } }
                      : {}
                }
                whileHover={a.href && !saliendo ? { y: -8, rotateX: 8, scale: 1.03, transition: { duration: 0.35, ease } } : undefined}
                whileTap={a.href ? { scale: 0.97 } : undefined}
                className={`group relative flex aspect-[4/3] flex-col justify-between overflow-hidden rounded-3xl border p-5 text-left backdrop-blur-xl transition-colors md:aspect-[5/4] md:p-5 2xl:aspect-square ${
                  a.href ? "cursor-pointer border-white/15 bg-white/[0.06] hover:border-white/30 hover:bg-white/[0.1]" : "cursor-default border-white/5 bg-white/[0.02] text-white/35"
                } ${i === areas.length - 1 && areas.length % 2 ? "col-span-2 aspect-[8/3] md:col-span-1 md:aspect-[5/4] 2xl:aspect-square" : ""}`}
                style={{ transformStyle: "preserve-3d" }}
              >
                <span className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-accent/0 blur-3xl transition-all duration-500 group-hover:bg-accent/40" />
                <span className="flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.2em] text-white/50">
                  0{i + 1}
                  {a.alerta && <span className="h-2 w-2 animate-pulse rounded-full bg-accent" aria-label="Pendiente" />}
                </span>
                <span>
                  <span className="block text-xl font-black tracking-tight md:text-2xl">
                    {a.nombre}
                    <span className="punto text-accent">.</span>
                  </span>
                  <span className="mt-1 block text-xs text-white/50">{a.href ? a.detalle : "Próximamente"}</span>
                </span>
                {a.href && (
                  <span className="absolute bottom-5 right-5 translate-x-2 text-lg opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100 md:bottom-6 md:right-6">→</span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* velo final de la transición hacia la sección */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        initial={false}
        animate={{ opacity: velo ? 1 : 0 }}
        transition={{ duration: 0.55, ease }}
        style={{ background: saliendo?.nombre === "Dirección" ? "#eceae6" : "#ffffff" }}
      />
    </div>
  );
}

/* ---------- Notificaciones importantes ---------- */
const CLAVE_LEIDOS = "yb_comentarios_leidos";
const hace = (iso: string) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? "hoy" : d === 1 ? "ayer" : `hace ${d} días`;
};

function Grupo({ titulo, cantidad, href, vacio, children }: { titulo: string; cantidad: number; href: string; vacio: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-white/10 py-4 first:border-t-0 first:pt-0">
      <a href={href} className="group mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/55 group-hover:text-white">
          {titulo}
          {cantidad > 0 && <span className="rounded-full bg-white/95 px-1.5 text-[10px] leading-4 text-[#121111]">{cantidad}</span>}
        </span>
        <span className="text-xs text-white/30 transition-transform group-hover:translate-x-0.5 group-hover:text-white">→</span>
      </a>
      {cantidad ? <ul className="space-y-1">{children}</ul> : <p className="text-xs text-white/35">{vacio}</p>}
    </section>
  );
}

function Item({ href, titulo, sub, extra }: { href: string; titulo: string; sub: string; extra?: React.ReactNode }) {
  return (
    <li>
      <a href={href} className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/[0.07]">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{titulo}</span>
          <span className="block truncate text-[11px] text-white/45">{sub}</span>
        </span>
        {extra}
      </a>
    </li>
  );
}

// Comentarios leídos: se marcan en este navegador desde RRHH › Comentarios.
function suscribirLeidos(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}
function leidosRaw() {
  try {
    return localStorage.getItem(CLAVE_LEIDOS) ?? "[]";
  } catch {
    return "[]";
  }
}

function PanelConComentarios({ n, promesa }: { n: Notificaciones; promesa: Promise<ComentarioAviso[]> }) {
  return <PanelNotificaciones n={n} comentarios={use(promesa)} />;
}

/** `comentarios` en null: todavía cargando (se muestra "…" en ese grupo). */
function PanelNotificaciones({ n, comentarios: todos }: { n: Notificaciones; comentarios: ComentarioAviso[] | null }) {
  const raw = useSyncExternalStore(suscribirLeidos, leidosRaw, () => null);
  const leidos = useMemo(() => {
    if (raw === null) return null;
    try {
      return new Set(JSON.parse(raw) as string[]);
    } catch {
      return new Set<string>();
    }
  }, [raw]);
  const comentarios = leidos && todos ? todos.filter((c) => !leidos.has(c.id)) : [];
  const total = n.followUp.length + n.casos.length + comentarios.length;

  return (
    <div className="flex h-full flex-col rounded-3xl border border-white/15 bg-[#161515]/70 p-5 backdrop-blur-xl">
      <div className="mb-4 flex items-baseline justify-between">
        <p className="text-lg font-black tracking-tight">
          Notificaciones<span className="punto text-accent">.</span>
        </p>
        <p className="text-xs text-white/45">{total ? `${total} importantes` : "Todo al día"}</p>
      </div>
      <div className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2">
        <Grupo titulo="Follow up" cantidad={n.followUp.length} href="/clientes/dashboard" vacio="Ningún cliente para revisar.">
          {n.followUp.map((f) => (
            <Item
              key={f.id}
              href={`/clientes/${f.id}`}
              titulo={f.nombre}
              sub={f.dias === 0 ? "Toca hoy" : `Atrasado ${-f.dias} ${-f.dias === 1 ? "día" : "días"}`}
              extra={<span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-white/95" />}
            />
          ))}
        </Grupo>
        <Grupo titulo="Casos nuevos" cantidad={n.casos.length} href="/rrhh/casos" vacio="Sin casos nuevos esta semana.">
          {n.casos.map((c, i) => (
            <Item
              key={i}
              href="/rrhh/casos"
              titulo={c.titulo}
              sub={`${c.cliente ?? "Sin cliente"} · ${hace(c.fecha)}`}
              extra={<span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${c.gravedad === "Leve" ? "border-white/20 text-white/60" : "border-accent/70 text-accent"}`}>{c.gravedad}</span>}
            />
          ))}
        </Grupo>
        <Grupo titulo="Comentarios nuevos" cantidad={comentarios.length} href="/rrhh/comentarios" vacio={leidos && todos ? "No hay comentarios sin leer." : "…"}>
          {comentarios.slice(0, 6).map((c) => (
            <Item key={c.id} href="/rrhh/comentarios" titulo={c.cliente} sub={`${c.autor}: ${c.texto}`} />
          ))}
          {comentarios.length > 6 && <li className="px-2 pt-1 text-[11px] text-white/40">y {comentarios.length - 6} más…</li>}
        </Grupo>
      </div>
    </div>
  );
}

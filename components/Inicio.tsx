"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

export type PuntoInicio = { lat: number; lng: number };
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

export function Inicio({ puntos, areas, nombre }: { puntos: PuntoInicio[]; areas: AreaInicio[]; nombre?: string }) {
  const router = useRouter();
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<maplibregl.Map | null>(null);
  const [listo, setListo] = useState(false);
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
      m.setPaintProperty("argentina", "fill-extrusion-height", 22000);
      m.setPaintProperty("provincias-borde", "line-opacity", 0.6);
      setListo(true);

      // Entrada de cámara: desde el mundo hasta Argentina en perspectiva.
      m.flyTo({ center: CENTRO_AR, zoom: 3.6, pitch: 58, bearing: -18, padding: { top: 0, left: 0, right: 0, bottom: m.getContainer().clientHeight * 0.38 }, duration: 4200, curve: 1.2, essential: true });

      // Columnas que crecen escalonadas + pulso del halo + órbita lenta de cámara.
      const altos = puntos.map((_, i) => 70000 + ((i * 7919) % 9) * 9000);
      const inicio = performance.now();
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
            transition={{ duration: 1, delay: 0.4, ease }}
            className="absolute left-6 top-6 md:left-10 md:top-8"
          >
            <p className="text-2xl font-black tracking-tight md:text-3xl">
              Yourebrand<span className="text-accent">.</span>
            </p>
            <p className="mt-1 text-[11px] font-extralight text-white/60">Agencia Full service de marketing digital.</p>
          </motion.header>
        )}
      </AnimatePresence>

      <div className="absolute inset-x-0 bottom-0 px-4 pb-8 md:px-10 md:pb-12" style={{ perspective: 1400 }}>
        <AnimatePresence>
          {!saliendo && (
            <motion.div key="titulo" exit={{ opacity: 0, y: 20, filter: "blur(6px)", transition: { duration: 0.5 } }}>
              <motion.p
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: listo ? 1 : 0, y: listo ? 0 : 24 }}
                transition={{ duration: 1.1, delay: 2.6, ease }}
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
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
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
                      ? { opacity: 1, y: 0, rotateX: 0, filter: "blur(0px)", transition: { duration: 1, delay: 3 + i * 0.11, ease } }
                      : {}
                }
                whileHover={a.href && !saliendo ? { y: -8, rotateX: 8, scale: 1.03, transition: { duration: 0.35, ease } } : undefined}
                whileTap={a.href ? { scale: 0.97 } : undefined}
                className={`group relative flex aspect-[4/3] flex-col justify-between overflow-hidden rounded-3xl border p-5 text-left backdrop-blur-xl transition-colors md:aspect-square md:p-6 ${
                  a.href ? "cursor-pointer border-white/15 bg-white/[0.06] hover:border-white/30 hover:bg-white/[0.1]" : "cursor-default border-white/5 bg-white/[0.02] text-white/35"
                } ${i === areas.length - 1 && areas.length % 2 ? "col-span-2 aspect-[8/3] md:col-span-1 md:aspect-square" : ""}`}
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
                    <span className="text-accent">.</span>
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

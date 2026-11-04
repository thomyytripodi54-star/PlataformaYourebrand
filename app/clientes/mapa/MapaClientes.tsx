"use client";

import Link from "next/link";
import createGlobe from "cobe";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { Logo } from "@/components/Logo";
import type { Cliente } from "@/lib/clientes";
import { PAISES, SEDE, angulos } from "@/lib/geo";

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
    let theta = 0.25;
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
        phi += 0.0025;
        theta += (0.25 - theta) * 0.03;
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

function TarjetaCliente({ c, i }: { c: Cliente; i: number }) {
  // inclinación 3D siguiendo el mouse
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rx = useSpring(useTransform(y, [-0.5, 0.5], [8, -8]), { stiffness: 200, damping: 18 });
  const ry = useSpring(useTransform(x, [-0.5, 0.5], [-8, 8]), { stiffness: 200, damping: 18 });
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
        <Link
          href={`/clientes/${c.id}`}
          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 transition-colors hover:border-accent/60 hover:bg-white/[0.07]"
        >
          <Logo cliente={c} size={38} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{c.nombre}</p>
            <p className="truncate text-[11px] text-white/45">
              {c.rubros.slice(0, 2).join(" · ") || "—"}
            </p>
          </div>
        </Link>
      </motion.div>
    </motion.li>
  );
}

export function MapaClientes({ clientes }: { clientes: Cliente[] }) {
  const [pais, setPais] = useState<string | null>(null);

  const paises = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of clientes) if (c.pais && PAISES[c.pais]) m.set(c.pais, (m.get(c.pais) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [clientes]);

  const lista = clientes.filter((c) => !pais || c.pais === pais).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return (
    <div className="-mx-4 -my-6 min-h-screen bg-ink px-4 py-8 text-white md:-mx-10 md:-my-8 md:px-10">
      <div className="mx-auto max-w-7xl">
        <motion.header initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}>
          <p className="text-xs font-medium uppercase tracking-wider text-white/40">Dirección · Clientes</p>
          <h1 className="mt-1 text-3xl font-black uppercase tracking-tight md:text-4xl">
            Mapa de clientes<span className="text-accent">.</span>
          </h1>
          <p className="mt-1 text-sm font-extralight text-white/60">
            Clientes activos en <span className="font-bold text-white">{paises.length} países</span>. Arrastrá el globo para girarlo.
          </p>
        </motion.header>

        <div className="mt-8 grid grid-cols-1 items-start gap-10 lg:grid-cols-[1.15fr_1fr]">
          <div className="lg:sticky lg:top-8">
            <Globo paises={paises} foco={pais} />
          </div>

          <div>
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/[0.04] p-4">
                <p className="text-4xl font-black tracking-tight text-accent">
                  <Contador valor={lista.length} />
                </p>
                <p className="mt-1 text-[11px] uppercase tracking-wider text-white/50">{pais ? `Clientes en ${pais}` : "Clientes activos"}</p>
              </div>
              <div className="rounded-2xl bg-white/[0.04] p-4">
                <p className="text-4xl font-black tracking-tight">
                  <Contador valor={pais ? 1 : paises.length} />
                </p>
                <p className="mt-1 text-[11px] uppercase tracking-wider text-white/50">{pais ? PAISES[pais].ciudad : "Países"}</p>
              </div>
            </div>

            {/* Filtro por país */}
            <div className="mt-6 flex flex-wrap gap-2">
              {[["Todos", clientes.length] as [string, number], ...paises].map(([p, n]) => {
                const activo = (p === "Todos" && !pais) || p === pais;
                return (
                  <button
                    key={p}
                    onClick={() => setPais(p === "Todos" ? null : p)}
                    className="relative rounded-full px-4 py-2 text-sm font-semibold"
                  >
                    {activo && (
                      <motion.span
                        layoutId="chip-pais"
                        className="absolute inset-0 rounded-full bg-accent"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      />
                    )}
                    <span className={`relative flex items-center gap-2 ${activo ? "text-white" : "text-white/60 hover:text-white"}`}>
                      {p !== "Todos" && <span>{PAISES[p].bandera}</span>}
                      {p}
                      <span className={`rounded-full px-1.5 text-[11px] ${activo ? "bg-white/20" : "bg-white/10"}`}>{n}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Clientes */}
            <motion.ul layout className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <AnimatePresence mode="popLayout">
                {lista.map((c, i) => (
                  <TarjetaCliente key={c.id} c={c} i={i} />
                ))}
              </AnimatePresence>
            </motion.ul>
          </div>
        </div>
      </div>
    </div>
  );
}

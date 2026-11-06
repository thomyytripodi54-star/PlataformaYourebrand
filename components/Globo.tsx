"use client";

import createGlobe from "cobe";
import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { PAISES, SEDE, angulos } from "@/lib/geo";

const ease = [0.22, 1, 0.36, 1] as const;
const ROJO: [number, number, number] = [211 / 255, 8 / 255, 5 / 255];

export function Globo({ paises, foco }: { paises: [string, number][]; foco: string | null }) {
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

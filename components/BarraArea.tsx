"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { areaDe } from "@/lib/areas";

const ease = [0.22, 1, 0.36, 1] as const;

/** Barra superior de cada área: volver al inicio y moverse solo entre las secciones de esa área. */
export function BarraArea({ pendiente, extra }: { pendiente: boolean; extra?: React.ReactNode }) {
  const path = usePathname();
  const area = areaDe(path);
  if (path === "/" || path.startsWith("/login")) return null;
  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease }}
      className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-zinc-200 bg-white/90 px-4 backdrop-blur md:gap-6 md:px-8"
    >
      <Link href="/" className="group flex shrink-0 items-center gap-2 rounded-full bg-ink px-3.5 py-1.5 text-xs font-bold text-white hover:bg-accent">
        <span className="transition-transform group-hover:-translate-x-0.5">←</span> Inicio
      </Link>
      <p className="shrink-0 text-lg font-black tracking-tight">
        {area?.nombre ?? "Yourebrand"}
        <span className="text-accent">.</span>
      </p>
      {area && area.secciones.length > 1 && (
        <nav className="flex min-w-0 gap-1 overflow-x-auto">
          {area.secciones.map((s) => {
            const activo = path === s.href || path.startsWith(s.href + "/");
            return (
              <Link key={s.href} href={s.href} className="relative shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold">
                {activo && <motion.span layoutId="seccion-activa" className="absolute inset-0 rounded-full bg-surface" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
                <span className={`relative ${activo ? "text-ink" : "text-zinc-500 hover:text-ink"}`}>{s.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
      {area?.nombre === "Finanzas" && pendiente && <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-accent" aria-label="Consolidación pendiente" />}
      <div className="ml-auto flex shrink-0 items-center gap-4">{extra}</div>
    </motion.header>
  );
}

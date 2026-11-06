"use client";

import { usePathname } from "next/navigation";
import { motion } from "motion/react";

/** Entrada suave de cada pantalla, con el mismo lenguaje que el inicio.
 *  Solo opacidad: un transform o filter en el contenedor rompería los elementos `fixed` (mapa a pantalla completa, paneles). */
export default function Template({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path === "/") return children;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

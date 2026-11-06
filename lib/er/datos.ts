import "server-only";
import { cache } from "react";
import { meses as base, mesPendiente, type MesER } from "@/lib/finanzas";
import { mesesGuardados } from "./almacen";

/** Meses del ER: los importados + los consolidados desde la plataforma (estos ganan). */
export async function todosLosMeses({ fresco = false } = {}): Promise<MesER[]> {
  const guardados = await mesesGuardados({ fresco });
  const k = (m: MesER) => `${m.anio}-${m.mes}`;
  const porClave = new Map(base.map((m) => [k(m), m]));
  for (const g of guardados) porClave.set(k(g), g);
  return [...porClave.values()].sort((a, b) => a.anio - b.anio || a.mes - b.mes);
}

/** Mes pendiente de consolidar. `cache`: el layout y la página de Finanzas lo piden en la misma carga. */
export const pendienteActual = cache(async function pendienteActual() {
  try {
    return mesPendiente(await todosLosMeses());
  } catch (e) {
    console.error("[finanzas] No se pudo calcular el mes pendiente:", e);
    return mesPendiente(base);
  }
});

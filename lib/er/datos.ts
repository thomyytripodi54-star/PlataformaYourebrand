import "server-only";
import { meses as base, mesPendiente, type MesER } from "@/lib/finanzas";
import { mesesGuardados } from "./almacen";

/** Meses del ER: los importados + los consolidados desde la plataforma (estos ganan). */
export async function todosLosMeses(): Promise<MesER[]> {
  const guardados = await mesesGuardados();
  const k = (m: MesER) => `${m.anio}-${m.mes}`;
  const porClave = new Map(base.map((m) => [k(m), m]));
  for (const g of guardados) porClave.set(k(g), g);
  return [...porClave.values()].sort((a, b) => a.anio - b.anio || a.mes - b.mes);
}

export async function pendienteActual() {
  return mesPendiente(await todosLosMeses());
}

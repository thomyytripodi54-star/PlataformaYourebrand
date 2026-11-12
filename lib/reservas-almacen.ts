import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { almacenConfigurado, redis } from "@/lib/er/almacen";
import { clave, combinar, reservasBase, type ReservaMes } from "@/lib/reservas";

/** Reservas cargadas desde la plataforma: un campo por mes ("2026-11") en un hash de Upstash Redis. */
const HASH = "reservas";
export const TAG_RESERVAS = "reservas";

async function leerCargadas(): Promise<ReservaMes[]> {
  const plano = await redis<string[]>("HGETALL", HASH);
  const out: ReservaMes[] = [];
  for (let i = 0; i < plano.length; i += 2) out.push(JSON.parse(plano[i + 1]) as ReservaMes);
  return out;
}
const cargadasEnCache = unstable_cache(leerCargadas, ["reservas"], { revalidate: 3600, tags: [TAG_RESERVAS] });

/** Historial completo de reservas (planilla + lo cargado). `cache`: el resumen y la página lo piden en la misma carga. */
export const todasLasReservas = cache(async function todasLasReservas(): Promise<ReservaMes[]> {
  if (!almacenConfigurado()) return combinar(reservasBase, []);
  try {
    return combinar(reservasBase, await cargadasEnCache());
  } catch (e) {
    console.error("[reservas] No se pudieron leer las reservas cargadas:", e);
    return combinar(reservasBase, []);
  }
});

export async function guardarReserva(m: ReservaMes) {
  await redis("HSET", HASH, clave(m), JSON.stringify({ ...m, cargadoEn: new Date().toISOString() }));
}

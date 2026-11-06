import "server-only";
import { almacenConfigurado, redis } from "@/lib/er/almacen";
import { estado, type EstadoFollowUp, type FollowUp } from "@/lib/followup-calculo";

export { estado, type EstadoFollowUp, type FollowUp };

/** Frecuencias de follow up, en días. */
export const FRECUENCIAS = [
  { dias: 7, label: "Cada 7 días" },
  { dias: 15, label: "Cada 15 días" },
  { dias: 30, label: "Cada 30 días" },
  { dias: 90, label: "Cada 3 meses" },
] as const;


const CLAVE = "followup";

/** Follow ups configurados, por id de cliente (guardados en Upstash Redis). */
export async function followUps(): Promise<Record<string, FollowUp>> {
  if (!almacenConfigurado()) return {};
  try {
    const v = await redis<string | null>("GET", CLAVE);
    return v ? (JSON.parse(v) as Record<string, FollowUp>) : {};
  } catch {
    return {};
  }
}

export async function guardarFollowUps(f: Record<string, FollowUp>) {
  await redis("SET", CLAVE, JSON.stringify(f));
}

/** Ids de clientes con follow up vencido, del más atrasado al menos. */
export async function pendientesFollowUp(): Promise<{ id: string; estado: EstadoFollowUp }[]> {
  const f = await followUps();
  return Object.entries(f)
    .map(([id, x]) => ({ id, estado: estado(x) }))
    .filter((x) => x.estado.vencido)
    .sort((a, b) => a.estado.dias - b.estado.dias);
}

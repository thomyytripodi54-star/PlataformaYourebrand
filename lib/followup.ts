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


// Un campo por cliente en un hash de Redis: dos personas editando clientes distintos a la vez no se pisan.
const HASH = "followups";
const LEGADO = "followup"; // formato anterior: todo en un solo JSON

/** Follow ups configurados, por id de cliente (guardados en Upstash Redis). */
export async function followUps(): Promise<Record<string, FollowUp>> {
  if (!almacenConfigurado()) return {};
  try {
    const plano = await redis<string[]>("HGETALL", HASH);
    if (plano.length) {
      const out: Record<string, FollowUp> = {};
      for (let i = 0; i < plano.length; i += 2) out[plano[i]] = JSON.parse(plano[i + 1]);
      return out;
    }
    // Migración única desde el formato anterior.
    const viejo = await redis<string | null>("GET", LEGADO);
    if (!viejo) return {};
    const f = JSON.parse(viejo) as Record<string, FollowUp>;
    if (Object.keys(f).length) await redis("HSET", HASH, ...Object.entries(f).flatMap(([id, x]) => [id, JSON.stringify(x)]));
    await redis("DEL", LEGADO);
    return f;
  } catch {
    return {};
  }
}

export async function followUpDe(id: string): Promise<FollowUp | null> {
  await followUps(); // asegura la migración del formato anterior
  const v = await redis<string | null>("HGET", HASH, id);
  return v ? (JSON.parse(v) as FollowUp) : null;
}

export async function guardarFollowUp(id: string, f: FollowUp | null) {
  if (f) await redis("HSET", HASH, id, JSON.stringify(f));
  else await redis("HDEL", HASH, id);
}

/** Ids de clientes con follow up vencido, del más atrasado al menos. */
export async function pendientesFollowUp(): Promise<{ id: string; estado: EstadoFollowUp }[]> {
  const f = await followUps();
  return Object.entries(f)
    .map(([id, x]) => ({ id, estado: estado(x) }))
    .filter((x) => x.estado.vencido)
    .sort((a, b) => a.estado.dias - b.estado.dias);
}

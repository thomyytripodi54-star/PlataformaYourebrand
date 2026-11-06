import "server-only";
import { unstable_cache } from "next/cache";
import type { MesER } from "@/lib/finanzas";

/**
 * Meses consolidados desde la plataforma, en Upstash Redis (privado).
 * Vercel → Storage → Upstash for Redis crea KV_REST_API_URL y KV_REST_API_TOKEN.
 * Cada consolidación guarda una versión nueva en el historial; nunca se pisa sin confirmar.
 */
// Vercel permite elegir un prefijo al conectar la base (KV_, STORAGE_, UPSTASH_…): se busca con cualquier prefijo.
function envQueTermina(...sufijos: string[]) {
  for (const suf of sufijos) {
    const k = Object.keys(process.env).find((n) => n === suf || n.endsWith("_" + suf));
    if (k && process.env[k]) return process.env[k];
  }
  return undefined;
}
const URL_ = envQueTermina("KV_REST_API_URL", "REDIS_REST_URL", "REST_API_URL");
const TOKEN = envQueTermina("KV_REST_API_TOKEN", "REDIS_REST_TOKEN", "REST_API_TOKEN");
export const almacenConfigurado = () => !!(URL_ && TOKEN) || !!process.env.ER_FIXTURES;

// Modo de prueba local: memoria del proceso (nunca activo en Vercel).
const memoria = globalThis as unknown as { __erMem?: Map<string, unknown> };
async function enMemoria(cmd: (string | number)[]): Promise<unknown> {
  const m = (memoria.__erMem ??= new Map());
  const [op, k, ...r] = cmd.map(String);
  const lista = () => (m.get(k) as string[] | undefined) ?? [];
  switch (op) {
    case "GET": return m.get(k) ?? null;
    case "SET": m.set(k, r[0]); return "OK";
    case "INCR": m.set(k, Number(m.get(k) ?? 0) + 1); return m.get(k);
    case "RPUSH": m.set(k, [...lista(), ...r]); return lista().length;
    case "LRANGE": return lista();
    case "SADD": m.set(k, [...new Set([...lista(), ...r])]); return 1;
    case "SMEMBERS": return lista();
    case "MGET": return [k, ...r].map((x) => m.get(x) ?? null);
    case "DEL": m.delete(k); return 1;
    case "HSET": { const h = { ...((m.get(k) as Record<string, string>) ?? {}) }; for (let i = 0; i < r.length; i += 2) h[r[i]] = r[i + 1]; m.set(k, h); return 1; }
    case "HDEL": { const h = { ...((m.get(k) as Record<string, string>) ?? {}) }; for (const f of r) delete h[f]; m.set(k, h); return 1; }
    case "HGET": return ((m.get(k) as Record<string, string>) ?? {})[r[0]] ?? null;
    case "HGETALL": return Object.entries((m.get(k) as Record<string, string>) ?? {}).flat();
  }
  return null;
}

export async function redis<T = unknown>(...cmd: (string | number)[]): Promise<T> {
  if (process.env.ER_FIXTURES) return (await enMemoria(cmd)) as T;
  if (!URL_ || !TOKEN) throw new Error("La plataforma no encuentra la base Upstash Redis. Revisá que esté conectada al proyecto (Storage → la base → Projects) y hacé Redeploy para que tome sus variables.");
  const r = await fetch(URL_, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(cmd), cache: "no-store" });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(`Almacenamiento: ${j.error ?? r.status}`);
  return j.result as T;
}

const clave = (anio: number, mes: number) => `er:${anio}-${String(mes).padStart(2, "0")}`;

export type Version = { mes: MesER; version: number; consolidadoPor: string; consolidadoEn: string; archivo: string; resultado: string };

/** Meses guardados (la última versión de cada uno). */
export const TAG_ER = "er-meses";

async function leerMeses(): Promise<MesER[]> {
  const claves = await redis<string[]>("SMEMBERS", "er:meses");
  if (!claves.length) return [];
  const vals = await redis<(string | null)[]>("MGET", ...claves);
  return vals.filter((v): v is string => !!v).map((v) => (JSON.parse(v) as Version).mes);
}
// Antes se leían de Redis en cada pantalla (el aviso de Finanzas está en la barra de todas las áreas).
// Ahora quedan en caché y se invalidan al consolidar un mes. Los errores no se guardan en caché.
const mesesEnCache = unstable_cache(leerMeses, ["er-meses"], { revalidate: 3600, tags: [TAG_ER] });

/** Meses consolidados. `fresco` lee directo de Redis (para escribir sobre datos al día). */
export async function mesesGuardados({ fresco = false } = {}): Promise<MesER[]> {
  if (!almacenConfigurado()) return [];
  try {
    return fresco ? await leerMeses() : await mesesEnCache();
  } catch (e) {
    console.error("[finanzas] No se pudieron leer los meses guardados:", e);
    return [];
  }
}

export async function versionActual(anio: number, mes: number): Promise<Version | null> {
  const v = await redis<string | null>("GET", clave(anio, mes));
  return v ? (JSON.parse(v) as Version) : null;
}

/** Guarda una versión nueva del mes y la agrega al historial y al log. */
export async function guardarVersion(v: Omit<Version, "version">) {
  const k = clave(v.mes.anio, v.mes.mes);
  const version = Number(await redis("INCR", `${k}:n`));
  const reg: Version = { ...v, version };
  const json = JSON.stringify(reg);
  await redis("RPUSH", `${k}:historial`, json);
  await redis("SET", k, json);
  await redis("SADD", "er:meses", k);
  await redis("RPUSH", "er:log", JSON.stringify({ mes: k, version, por: v.consolidadoPor, en: v.consolidadoEn, archivo: v.archivo, resultado: v.resultado }));
  return reg;
}

export async function historial(anio: number, mes: number): Promise<Version[]> {
  const xs = await redis<string[]>("LRANGE", `${clave(anio, mes)}:historial`, 0, -1);
  return xs.map((x) => JSON.parse(x));
}

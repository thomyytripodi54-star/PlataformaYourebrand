import "server-only";
import { unstable_cache } from "next/cache";
import copia from "@/data/asistente/planilla.json";
import { pestanaComoTexto } from "./formato";
import { credencialesDeEnv, explicarErrorGoogle, jwtCuentaServicio, type CuentaServicio } from "./google";

/**
 * Pestañas de la planilla "Yourebrand Finanzas" que lee el asistente.
 * En vivo con una cuenta de servicio de Google (variable GOOGLE_SERVICE_ACCOUNT_JSON, con la planilla
 * compartida a su email como lector). Sin ella, usa la copia de data/asistente/planilla.json.
 */
const PLANILLA = "1cDu6BbGmY8HiFB2LBEHuq1ZmTt-iJ9cFvZcHc1JXKLE";
const RANGOS: Record<string, string> = {
  "Resumen INV publicitaria (USD)": "'Resumen INV publicitaria'!B12:N40",
  "INV publicitaria por campaña (USD)": "'INV publicitaria por campaña'!D3:O90",
  "Metricas Agencia 2026": "'Metricas Agencia 2026'!C4:Q25",
  "OBJETIVOS 2026": "'OBJETIVOS 2026'!C7:L60",
};

/** Pestañas de cada mes ("Octubre 26") y de cada trimestre ("Metricas Agencia Q3 2026"): ER, objetivos, análisis y progreso. */
const ES_MES = /^(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre) \d{2}$/i;
const ES_TRIMESTRE = /metricas agencia|crecimiento de agencia/i;

export type Planilla = {
  origen: "en vivo" | "copia";
  actualizado: string;
  /** Tablas de resumen (publicidad, métricas del año y objetivos). */
  tablas: Record<string, string[][]>;
  /** Pestañas de meses y trimestres, como texto. */
  pestanas: Record<string, string>;
  /** Si está configurada la lectura en vivo pero falla: qué pasa y qué hacer. */
  error?: string;
  /** Email de la cuenta de servicio configurada (para compartirle la planilla). */
  cuenta?: string;
};

async function tokenGoogle(cred: CuentaServicio) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwtCuentaServicio(cred) }),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(explicarErrorGoogle(r.status, await r.text(), cred.client_email));
  return ((await r.json()) as { access_token: string }).access_token;
}

const enVivo = unstable_cache(
  async (): Promise<Planilla> => {
    const cred = credencialesDeEnv(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
    const token = await tokenGoogle(cred);
    const get = async (ruta: string) => {
      const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${PLANILLA}${ruta}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!r.ok) throw new Error(explicarErrorGoogle(r.status, await r.text(), cred.client_email));
      return r.json();
    };
    // Las pestañas de meses y trimestres se detectan solas: las nuevas ("Noviembre 26", "Metricas Agencia Q1 2027") entran sin tocar código.
    const meta = (await get("?fields=sheets.properties.title")) as { sheets: { properties: { title: string } }[] };
    const titulos = meta.sheets.map((x) => x.properties.title);
    const pestanas = titulos.filter((t) => ES_MES.test(t.trim()) || (ES_TRIMESTRE.test(t) && t.trim() !== "Metricas Agencia 2026"));
    const resumen = Object.keys(RANGOS);
    const rangos = [...resumen.map((n) => RANGOS[n]), ...pestanas.map((t) => `'${t.replace(/'/g, "''")}'!A1:AC90`)];
    const j = (await get(`/values:batchGet?${rangos.map((x) => `ranges=${encodeURIComponent(x)}`).join("&")}`)) as { valueRanges: { values?: string[][] }[] };
    return {
      origen: "en vivo",
      actualizado: new Date().toISOString().slice(0, 10),
      tablas: Object.fromEntries(resumen.map((n, i) => [n, j.valueRanges[i]?.values ?? []])),
      pestanas: Object.fromEntries(pestanas.map((t, i) => [t.trim(), pestanaComoTexto(j.valueRanges[resumen.length + i]?.values ?? [])])),
    };
  },
  ["asistente-planilla-v2"],
  { revalidate: 900 },
);

export async function leerPlanilla(): Promise<Planilla> {
  const base: Planilla = { origen: "copia", actualizado: copia.copiaDel, tablas: copia.tablas, pestanas: copia.pestanas };
  const env = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!env) return base;
  let cuenta: string | undefined;
  try {
    cuenta = credencialesDeEnv(env).client_email;
    return { ...(await enVivo()), cuenta };
  } catch (e) {
    console.error("[asistente] No se pudo leer la planilla en vivo, uso la copia:", e);
    return { ...base, cuenta, error: e instanceof Error ? e.message : String(e) };
  }
}

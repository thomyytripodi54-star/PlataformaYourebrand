import "server-only";
import { createSign } from "node:crypto";
import { unstable_cache } from "next/cache";
import copia from "@/data/asistente/planilla.json";

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

export type Planilla = { origen: "en vivo" | "copia"; actualizado: string; tablas: Record<string, string[][]> };

async function tokenGoogle(cred: { client_email: string; private_key: string }) {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const ahora = Math.floor(Date.now() / 1000);
  const cuerpo = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: cred.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: ahora,
    exp: ahora + 3600,
  })}`;
  const firma = createSign("RSA-SHA256").update(cuerpo).sign(cred.private_key, "base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${cuerpo}.${firma}` }),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Google ${r.status}: ${await r.text()}`);
  return ((await r.json()) as { access_token: string }).access_token;
}

const enVivo = unstable_cache(
  async (): Promise<Planilla> => {
    const cred = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!) as { client_email: string; private_key: string };
    const token = await tokenGoogle(cred);
    const nombres = Object.keys(RANGOS);
    const qs = nombres.map((n) => `ranges=${encodeURIComponent(RANGOS[n])}`).join("&");
    const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${PLANILLA}/values:batchGet?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!r.ok) throw new Error(`Google Sheets ${r.status}: ${await r.text()}`);
    const j = (await r.json()) as { valueRanges: { values?: string[][] }[] };
    return {
      origen: "en vivo",
      actualizado: new Date().toISOString().slice(0, 10),
      tablas: Object.fromEntries(nombres.map((n, i) => [n, j.valueRanges[i]?.values ?? []])),
    };
  },
  ["asistente-planilla"],
  { revalidate: 900 },
);

export async function leerPlanilla(): Promise<Planilla> {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      return await enVivo();
    } catch (e) {
      console.error("[asistente] No se pudo leer la planilla en vivo, uso la copia:", e);
    }
  }
  return { origen: "copia", actualizado: copia.copiaDel, tablas: copia.tablas };
}

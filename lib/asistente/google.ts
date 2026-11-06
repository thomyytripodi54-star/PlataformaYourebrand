import { createSign } from "node:crypto";

/** Credenciales de la cuenta de servicio de Google (lo que importa del JSON que descarga Google Cloud). */
export type CuentaServicio = { client_email: string; private_key: string };

/**
 * Lee GOOGLE_SERVICE_ACCOUNT_JSON tal como se pegue en Vercel: el JSON completo o el mismo en base64.
 * Tolera la clave privada con los saltos de línea escapados ("\\n").
 */
export function credencialesDeEnv(valor: string): CuentaServicio {
  const texto = valor.trim();
  let j: Partial<CuentaServicio> & { type?: string };
  try {
    j = JSON.parse(texto.startsWith("{") ? texto : Buffer.from(texto, "base64").toString("utf8"));
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON no es un JSON válido: pegá el contenido completo del archivo .json que descargaste de Google Cloud.");
  }
  if (!j.client_email || !j.private_key) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON no tiene client_email o private_key: tiene que ser la clave JSON de una cuenta de servicio.");
  return { client_email: j.client_email, private_key: j.private_key.replace(/\\n/g, "\n") };
}

/** JWT firmado para pedir un token de solo lectura de Google Sheets. */
export function jwtCuentaServicio(cred: CuentaServicio, ahora = Math.floor(Date.now() / 1000)): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const cuerpo = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: cred.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: ahora,
    exp: ahora + 3600,
  })}`;
  return `${cuerpo}.${createSign("RSA-SHA256").update(cuerpo).sign(cred.private_key, "base64url")}`;
}

/** Traduce los errores típicos de Google a qué hay que hacer. */
export function explicarErrorGoogle(status: number, texto: string, email: string): string {
  if (/SERVICE_DISABLED|has not been used|is disabled/i.test(texto)) return "Falta habilitar la Google Sheets API en el proyecto de Google Cloud de la cuenta de servicio.";
  if (status === 403 || status === 404) return `La planilla no está compartida con la cuenta de servicio: compartila como Lector con ${email}.`;
  if (/invalid_grant|invalid_client|Invalid JWT/i.test(texto)) return "Google rechazó la clave de la cuenta de servicio: generá una clave JSON nueva y volvé a pegarla en Vercel.";
  return `Google respondió ${status}: ${texto.slice(0, 160)}`;
}

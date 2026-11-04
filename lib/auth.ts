// Sesión firmada con HMAC (Web Crypto: funciona en el proxy y en el servidor).
export const COOKIE = "yb_session";
const DIAS = 7;

async function firmar(valor: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Falta AUTH_SECRET");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(valor));
  return Buffer.from(sig).toString("base64url");
}

export async function crearSesion(usuario: string) {
  const exp = Date.now() + DIAS * 86400000;
  const valor = `${usuario}.${exp}`;
  return { valor: `${valor}.${await firmar(valor)}`, maxAge: DIAS * 86400 };
}

export async function sesionValida(token: string | undefined) {
  if (!token) return false;
  const i = token.lastIndexOf(".");
  const valor = token.slice(0, i);
  const exp = Number(valor.split(".").pop());
  if (!exp || exp < Date.now()) return false;
  try {
    return (await firmar(valor)) === token.slice(i + 1);
  } catch {
    return false;
  }
}

/** Compara en tiempo constante para no filtrar información. */
export function igualSeguro(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

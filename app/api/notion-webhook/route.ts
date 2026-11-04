import { createHmac, timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { TAG_NOTION } from "@/lib/datos";

// Notion avisa acá cada vez que cambia una página o base compartida con la integración.
export async function POST(req: Request) {
  const body = await req.text();
  let json: { verification_token?: string; type?: string } = {};
  try {
    json = JSON.parse(body);
  } catch {
    return new Response("JSON inválido", { status: 400 });
  }

  // 1) Alta del webhook: Notion manda un código que hay que pegar en su pantalla.
  if (json.verification_token) {
    console.log(`[notion-webhook] Código de verificación: ${json.verification_token}`);
    return Response.json({ ok: true });
  }

  // 2) Eventos: validar la firma con el código guardado en NOTION_WEBHOOK_SECRET.
  const secret = process.env.NOTION_WEBHOOK_SECRET;
  if (!secret) return new Response("Falta NOTION_WEBHOOK_SECRET", { status: 503 });
  const firma = req.headers.get("x-notion-signature") ?? "";
  const esperada = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
  if (firma.length !== esperada.length || !timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))) {
    return new Response("Firma inválida", { status: 401 });
  }

  revalidateTag(TAG_NOTION, { expire: 0 });
  console.log(`[notion-webhook] ${json.type ?? "evento"} → datos actualizados`);
  return Response.json({ ok: true });
}

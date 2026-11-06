import { createHmac, timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { TAG_COMENTARIOS, TAG_DATOS, TAG_MAPA_CALENDARIOS, tagCalendario, tagComentarios } from "@/lib/datos";

// Notion avisa acá cada vez que cambia una página o base compartida con la integración.
export async function POST(req: Request) {
  const body = await req.text();
  let json: {
    verification_token?: string;
    type?: string;
    entity?: { id?: string; type?: string };
    data?: { page_id?: string; parent?: { id?: string; type?: string } };
  } = {};
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

  // 3) Invalidar solo lo que cambió (antes se borraba todo: comentarios de los 34 clientes, calendarios
  //    y el mapa de calendarios, y la siguiente carga de cualquier pantalla arrancaba de cero).
  const tipo = json.type ?? "";
  const ya = { expire: 0 }; // se vuelve a leer en la próxima visita
  if (tipo.startsWith("comment.")) {
    // Solo los comentarios de la página comentada.
    const pagina = json.data?.page_id;
    if (pagina) revalidateTag(tagComentarios(pagina), ya);
    else revalidateTag(TAG_COMENTARIOS, "max");
  } else {
    // Páginas (clientes, casos, nómina, publicaciones) y bases: los datos generales son 3 consultas, se releen siempre.
    revalidateTag(TAG_DATOS, ya);
    // Si es una publicación de un calendario, se relee ese calendario.
    if (json.data?.parent?.id) revalidateTag(tagCalendario(json.data.parent.id), ya);
    if (json.entity?.id) revalidateTag(tagCalendario(json.entity.id), ya);
    // Bases nuevas, borradas o movidas: el mapa de calendarios se actualiza en segundo plano.
    if (tipo.startsWith("database.") || tipo.startsWith("data_source.")) revalidateTag(TAG_MAPA_CALENDARIOS, "max");
  }
  console.log(`[notion-webhook] ${tipo || "evento"} → actualizado`);
  return Response.json({ ok: true });
}

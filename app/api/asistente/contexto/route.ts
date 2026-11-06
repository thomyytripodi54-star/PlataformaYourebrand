import { cookies } from "next/headers";
import { COOKIE, sesionValida } from "@/lib/auth";
import { contextoAgencia, contextoDelDia } from "@/lib/asistente/contexto";

export const dynamic = "force-dynamic";

/**
 * Los datos de la agencia en Markdown, para pegarlos o subirlos al proyecto de Claude (claude.ai).
 * Incluye lo que solo vive en la plataforma (follow ups, meses consolidados acá) además de Notion y la planilla.
 * ?descargar=1 lo baja como archivo.
 */
export async function GET(req: Request) {
  if (!(await sesionValida((await cookies()).get(COOKIE)?.value))) return new Response("No autorizado", { status: 401 });
  const [datos, delDia] = await Promise.all([contextoAgencia(), contextoDelDia()]);
  const texto = `${delDia}\n\n${datos}\n`;
  const descargar = new URL(req.url).searchParams.has("descargar");
  const fecha = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
  return new Response(texto, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "no-store",
      ...(descargar ? { "Content-Disposition": `attachment; filename="datos-yourebrand-${fecha}.md"` } : {}),
    },
  });
}

import "server-only";
import { unstable_cache } from "next/cache";
import { TAG_DATOS } from "@/lib/datos";
import { DS, queryDataSource } from "@/lib/notion";

/** Una reunión de venta del "Funnel de venta" de Notion (sin teléfono ni email: el asistente no los necesita). */
export type ReunionVenta = {
  nombre: string;
  fechaReunion: string | null;
  estado: string | null; // No Atendio | Evaluando | Contrato
  fechaContratacion: string | null;
  campana: string | null; // de dónde vino: Argentina, Landing, Recomendacion, Remarketing, Prospeccion LinkedIn…
  calificacion: string[];
  pagoEur: number | null;
  pagoArs: number | null;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const texto = (v: any) => (v?.title ?? v?.rich_text ?? []).map((t: any) => t.plain_text).join("").trim();

const leer = unstable_cache(
  async (): Promise<ReunionVenta[]> => {
    const paginas = await queryDataSource(DS.funnelVenta);
    return paginas
      .map((p) => {
        const pr = p.properties;
        return {
          nombre: texto(pr["Nombre"]) || "(sin nombre)",
          fechaReunion: pr["Fecha de reunion"]?.date?.start ?? null,
          estado: pr["Estado"]?.status?.name ?? null,
          fechaContratacion: pr["Fecha de contratacion"]?.date?.start ?? null,
          campana: pr["Campaña"]?.select?.name ?? null,
          calificacion: (pr["Calificacion"]?.multi_select ?? []).map((o: any) => o.name),
          pagoEur: pr["Pago"]?.number ?? null,
          pagoArs: pr["Pago ars"]?.number ?? null,
        };
      })
      .sort((a, b) => (a.fechaReunion ?? "").localeCompare(b.fechaReunion ?? "") || a.nombre.localeCompare(b.nombre));
  },
  ["asistente-funnel-venta"],
  // Se refresca cuando cambia algo en Notion (webhook) o cada 10 minutos.
  { revalidate: 600, tags: [TAG_DATOS] },
);

export async function reunionesDeVenta(): Promise<{ reuniones: ReunionVenta[]; motivo?: string }> {
  if (!process.env.NOTION_TOKEN) return { reuniones: [], motivo: "Falta NOTION_TOKEN: no se pueden leer las reuniones de venta." };
  try {
    return { reuniones: await leer() };
  } catch (e) {
    console.error("[asistente] No se pudo leer el Funnel de venta:", e);
    const m = String(e instanceof Error ? e.message : e);
    return { reuniones: [], motivo: m.includes("404") ? "La integración de Notion no tiene acceso a «Reuniones de venta»: conectala a esa página." : `Error al leer el Funnel de venta: ${m.slice(0, 120)}` };
  }
}

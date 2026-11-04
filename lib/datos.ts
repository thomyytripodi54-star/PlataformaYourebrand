import "server-only";
import { unstable_cache } from "next/cache";
import clientesLocal from "@/data/clientes.json";
import equipoLocal from "@/data/equipo.json";
import type { Cliente } from "@/lib/clientes";
import type { Caso, Persona } from "@/lib/equipo";
import { DS, mapCaso, mapCliente, mapPersona, queryDataSource } from "@/lib/notion";

export const TAG_NOTION = "notion";

export type Datos = { clientes: Cliente[]; equipo: Persona[]; origen: "notion" | "local"; actualizado: string };

// Logos ya descargados (public/logos), por id de cliente.
const logos = new Map((clientesLocal as Cliente[]).map((c) => [c.id, c.logo]));

async function desdeNotion(): Promise<Datos> {
  const [pClientes, pCasos, pNomina] = await Promise.all([
    queryDataSource(DS.clientes, { property: "Estado 1", status: { equals: "Activo" } }),
    queryDataSource(DS.casos),
    queryDataSource(DS.nomina),
  ]);
  const clientes = pClientes.map((p) => mapCliente(p, logos));
  const clientePorNotion = new Map(clientes.map((c) => [c.notionId, c.id]));
  const casoPorNotion = new Map<string, Caso>();
  for (const p of pCasos) {
    const c = mapCaso(p, clientePorNotion);
    if (c) casoPorNotion.set(c.notionId, c);
  }
  const equipo = pNomina.map((p) => mapPersona(p, clientePorNotion, casoPorNotion)).filter((x): x is Persona => !!x);
  return { clientes, equipo, origen: "notion", actualizado: new Date().toISOString() };
}

const cacheado = unstable_cache(desdeNotion, ["datos-notion"], { revalidate: 60, tags: [TAG_NOTION] });

export async function getDatos(): Promise<Datos> {
  if (process.env.NOTION_TOKEN) {
    try {
      return await cacheado();
    } catch (e) {
      console.error("[notion] No se pudo leer Notion, uso los datos locales:", e);
    }
  }
  return {
    clientes: clientesLocal as Cliente[],
    equipo: equipoLocal as Persona[],
    origen: "local",
    actualizado: new Date().toISOString(),
  };
}

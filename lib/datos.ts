import "server-only";
import { unstable_cache } from "next/cache";
import clientesLocal from "@/data/clientes.json";
import equipoLocal from "@/data/equipo.json";
import type { Cliente } from "@/lib/clientes";
import { ordenarCasos, type Caso, type Persona } from "@/lib/equipo";
import { slug } from "@/lib/notion";
import { DS, mapCaso, mapCliente, mapPersona, queryDataSource } from "@/lib/notion";

export const TAG_NOTION = "notion";

export type Datos = { clientes: Cliente[]; equipo: Persona[]; casos: Caso[]; origen: "notion" | "local"; actualizado: string; motivo?: string };

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
  const respNotion = new Map<string, string[]>();
  for (const p of pCasos) {
    const c = mapCaso(p, clientePorNotion);
    if (!c) continue;
    const { responsablesNotion, ...caso } = c;
    casoPorNotion.set(c.notionId, caso);
    respNotion.set(c.notionId, responsablesNotion);
  }
  const equipo = pNomina.map((p) => mapPersona(p, clientePorNotion, casoPorNotion)).filter((x): x is Persona => !!x);
  // Responsables: "Account manager" del caso + quienes lo tienen en su ficha de la Nómina.
  const personaPorNotion = new Map(
    pNomina.map((p) => {
      const t = p.properties["Nombre"]?.title?.map((x: { plain_text: string }) => x.plain_text).join("") ?? "";
      return [p.id.replace(/-/g, ""), slug(t)] as const;
    }),
  );
  const ids = new Set(equipo.map((e) => e.id));
  const casos = [...casoPorNotion.entries()].map(([nid, c]) => {
    const r = new Set((respNotion.get(nid) ?? []).map((x) => personaPorNotion.get(x)).filter((x): x is string => !!x && ids.has(x)));
    for (const e of equipo) if (e.casosAbiertos.some((k) => k.notionUrl === c.notionUrl)) r.add(e.id);
    return { ...c, responsables: [...r] };
  });
  return { clientes, equipo, casos: ordenarCasos(casos), origen: "notion", actualizado: new Date().toISOString() };
}

const cacheado = unstable_cache(desdeNotion, ["datos-notion"], { revalidate: 60, tags: [TAG_NOTION] });

export async function getDatos(): Promise<Datos> {
  let motivo = "Falta la variable NOTION_TOKEN en Vercel (o falta hacer Redeploy).";
  if (process.env.NOTION_TOKEN) {
    try {
      return await cacheado();
    } catch (e) {
      console.error("[notion] No se pudo leer Notion, uso los datos locales:", e);
      const m = String(e instanceof Error ? e.message : e);
      motivo = m.includes("401")
        ? "Notion rechazó el token (401): revisá que NOTION_TOKEN esté bien copiado."
        : m.includes("404")
          ? "Notion no encuentra las bases (404): conectá la integración a la página Yourebrand (··· → Conexiones)."
          : `Error al leer Notion: ${m.slice(0, 160)}`;
    }
  }
  const equipo = equipoLocal as Persona[];
  const casos = new Map<string, Caso>();
  for (const e of equipo)
    for (const c of e.casosAbiertos) {
      const prev = casos.get(c.notionUrl);
      casos.set(c.notionUrl, { ...c, responsables: [...(prev?.responsables ?? []), e.id] });
    }
  return {
    motivo,
    clientes: clientesLocal as Cliente[],
    equipo,
    casos: ordenarCasos([...casos.values()]),
    origen: "local",
    actualizado: new Date().toISOString(),
  };
}

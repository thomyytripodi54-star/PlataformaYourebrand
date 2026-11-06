import "server-only";
import { unstable_cache } from "next/cache";
import clientesLocal from "@/data/clientes.json";
import equipoLocal from "@/data/equipo.json";
import type { Cliente } from "@/lib/clientes";
import { ordenarCasos, type Caso, type Persona } from "@/lib/equipo";
import { slug } from "@/lib/notion";
import { almacenConfigurado, redis } from "@/lib/er/almacen";
import { DS, idDeUrl, leerCalendario, listarComentarios, mapCaso, mapCliente, mapComentario, mapearCalendarios, mapPersona, queryDataSource, type Comentario, type Publicacion } from "@/lib/notion";

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

// Última lectura buena de Notion: si Notion falla un momento, se usa esto en vez de la copia local vieja.
const ultimaBuena = globalThis as unknown as { __ybDatos?: Datos };
async function desdeNotionConRespaldo(): Promise<Datos> {
  const d = await desdeNotion();
  ultimaBuena.__ybDatos = d;
  guardarRespaldo(d).catch(() => {});
  return d;
}
async function guardarRespaldo(d: Datos) {
  if (almacenConfigurado() && !process.env.ER_FIXTURES) await redis("SET", "datos:notion", JSON.stringify(d));
}
async function leerRespaldo(): Promise<Datos | null> {
  if (ultimaBuena.__ybDatos) return ultimaBuena.__ybDatos;
  if (!almacenConfigurado() || process.env.ER_FIXTURES) return null;
  try {
    const v = await redis<string | null>("GET", "datos:notion");
    return v ? (JSON.parse(v) as Datos) : null;
  } catch {
    return null;
  }
}

const cacheado = unstable_cache(desdeNotionConRespaldo, ["datos-notion"], { revalidate: 60, tags: [TAG_NOTION] });

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
      const respaldo = await leerRespaldo();
      if (respaldo) return respaldo;
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

/* ---------- Comentarios de clientes (Notion) ---------- */

export type DatosComentarios = { comentarios: Comentario[]; motivo?: string };

async function comentariosDesdeNotion(): Promise<Comentario[]> {
  const { clientes } = await getDatos();
  const out: Comentario[] = [];
  // De a 3 páginas por vez para respetar el límite de la API de Notion (~3 pedidos por segundo).
  for (let i = 0; i < clientes.length; i += 3) {
    const lote = clientes.slice(i, i + 3);
    const res = await Promise.all(
      lote.map(async (c) => {
        const id = idDeUrl(c.notionUrl);
        if (!id) return [];
        const crudos = await listarComentarios(id);
        return Promise.all(crudos.map((k) => mapComentario(k, c)));
      }),
    );
    out.push(...res.flat().filter((k) => k.texto));
  }
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

const comentariosCache = unstable_cache(comentariosDesdeNotion, ["comentarios-notion"], { revalidate: 120, tags: [TAG_NOTION] });

export async function getComentarios(): Promise<DatosComentarios> {
  if (!process.env.NOTION_TOKEN) return { comentarios: [], motivo: "Falta conectar Notion (NOTION_TOKEN) para leer los comentarios." };
  try {
    return { comentarios: await comentariosCache() };
  } catch (e) {
    console.error("[notion] No se pudieron leer los comentarios:", e);
    const m = String(e instanceof Error ? e.message : e);
    return {
      comentarios: [],
      motivo: m.includes("403")
        ? "La integración no tiene permiso para leer comentarios: activá «Leer comentarios» en notion.so/profile/integrations → Plataforma Yourebrand → Capacidades."
        : m.includes("404")
          ? "Notion no encuentra las páginas de clientes (404): conectá la integración a la página Yourebrand."
          : `Error al leer comentarios: ${m.slice(0, 160)}`,
    };
  }
}

/** Comentarios de un solo cliente: un pedido a Notion en vez de recorrer todos los clientes. */
const comentariosClienteCache = unstable_cache(
  async (id: string, notionUrl: string) => {
    const pid = idDeUrl(notionUrl);
    if (!pid) return [];
    const crudos = await listarComentarios(pid);
    const out = await Promise.all(crudos.map((k) => mapComentario(k, { id, notionUrl })));
    return out.filter((k) => k.texto).sort((a, b) => b.fecha.localeCompare(a.fecha));
  },
  ["comentarios-cliente"],
  { revalidate: 120, tags: [TAG_NOTION] },
);

export async function getComentariosCliente(id: string, notionUrl: string): Promise<DatosComentarios> {
  if (!process.env.NOTION_TOKEN) return { comentarios: [], motivo: "Falta conectar Notion (NOTION_TOKEN) para leer los comentarios." };
  try {
    return { comentarios: await comentariosClienteCache(id, notionUrl) };
  } catch (e) {
    console.error("[notion] No se pudieron leer los comentarios del cliente:", e);
    const m = String(e instanceof Error ? e.message : e);
    return { comentarios: [], motivo: m.includes("403") ? "La integración no tiene permiso para leer comentarios en Notion." : `Error al leer comentarios: ${m.slice(0, 160)}` };
  }
}

/* ---------- Calendario de contenido por cliente ---------- */
export type DatosCalendario = { publicaciones: Publicacion[]; tieneCalendario: boolean; motivo?: string };

const mapaCalendarios = unstable_cache(
  async () => {
    const { clientes } = await getDatos();
    const ids = new Set(clientes.map((c) => idDeUrl(c.notionUrl)).filter((x): x is string => !!x));
    return Object.fromEntries(await mapearCalendarios(ids));
  },
  ["mapa-calendarios"],
  { revalidate: 6 * 3600, tags: [TAG_NOTION, "calendarios"] },
);

const calendarioCache = unstable_cache(async (ds: string) => leerCalendario(ds), ["calendario"], { revalidate: 60, tags: [TAG_NOTION] });

export async function getCalendario(notionUrl: string): Promise<DatosCalendario> {
  if (!process.env.NOTION_TOKEN) return { publicaciones: [], tieneCalendario: false, motivo: "Falta conectar Notion (NOTION_TOKEN) para ver el calendario." };
  try {
    const id = idDeUrl(notionUrl);
    const ds = id ? (await mapaCalendarios())[id] : undefined;
    if (!ds) return { publicaciones: [], tieneCalendario: false };
    return { publicaciones: await calendarioCache(ds), tieneCalendario: true };
  } catch (e) {
    console.error("[notion] No se pudo leer el calendario:", e);
    const m = String(e instanceof Error ? e.message : e);
    return {
      publicaciones: [],
      tieneCalendario: false,
      motivo: m.includes("404") ? "La integración no tiene acceso a este calendario: conectala a la página Yourebrand en Notion." : `Error al leer el calendario: ${m.slice(0, 160)}`,
    };
  }
}

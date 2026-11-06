import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import clientesLocal from "@/data/clientes.json";
import equipoLocal from "@/data/equipo.json";
import type { Cliente } from "@/lib/clientes";
import { ordenarCasos, type Caso, type Persona } from "@/lib/equipo";
import { slug } from "@/lib/notion";
import { almacenConfigurado, redis } from "@/lib/er/almacen";
import { DS, idDeUrl, leerCalendario, listarComentarios, mapCaso, mapCliente, mapComentario, mapearCalendarios, mapPersona, queryDataSource, type Comentario, type Publicacion } from "@/lib/notion";

/* Etiquetas de caché: el webhook de Notion invalida solo lo que cambió (ver app/api/notion-webhook). */
export const TAG_DATOS = "notion-datos"; // clientes, casos y nómina (3 consultas, barato)
export const TAG_COMENTARIOS = "notion-comentarios"; // todos los comentarios; cada cliente además tiene "com:<página>"
export const TAG_MAPA_CALENDARIOS = "notion-mapa-calendarios"; // qué calendario es de qué cliente (búsqueda cara)
export const TAG_CALENDARIO = "notion-calendario"; // publicaciones; cada calendario además tiene "cal:<id>"
export const tagComentarios = (paginaId: string) => `com:${paginaId.replace(/-/g, "")}`;
export const tagCalendario = (id: string) => `cal:${id.replace(/-/g, "")}`;

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
// En caché: una lectura de Redis sin caché dentro de una página estática la rompe en producción.
const respaldoRedis = unstable_cache(async () => redis<string | null>("GET", "datos:notion"), ["respaldo-datos"], { revalidate: 60 });
async function leerRespaldo(): Promise<Datos | null> {
  if (ultimaBuena.__ybDatos) return ultimaBuena.__ybDatos;
  if (!almacenConfigurado() || process.env.ER_FIXTURES) return null;
  try {
    const v = await respaldoRedis();
    return v ? (JSON.parse(v) as Datos) : null;
  } catch {
    return null;
  }
}

const cacheado = unstable_cache(desdeNotionConRespaldo, ["datos-notion"], { revalidate: 60, tags: [TAG_DATOS] });

/** Datos de Notion (clientes, casos, equipo). `cache` evita repetir la lectura dentro de una misma carga (layout + página). */
export const getDatos = cache(async function getDatos(): Promise<Datos> {
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
});

/* ---------- Comentarios de clientes (Notion) ---------- */

export type DatosComentarios = { comentarios: Comentario[]; motivo?: string };

/** Comentarios de un cliente, en caché por cliente: los usan la ficha, el inicio y RRHH, y el webhook invalida solo el cliente comentado. */
function comentariosDe(id: string, notionUrl: string): Promise<Comentario[]> {
  const pid = idDeUrl(notionUrl);
  if (!pid) return Promise.resolve([]);
  return unstable_cache(
    async () => {
      const crudos = await listarComentarios(pid);
      const out = await Promise.all(crudos.map((k) => mapComentario(k, { id, notionUrl })));
      return out.filter((k) => k.texto);
    },
    ["comentarios-cliente-v2", pid, id],
    { revalidate: 300, tags: [TAG_COMENTARIOS, tagComentarios(pid)] },
  )();
}

function motivoComentarios(e: unknown): string {
  const m = String(e instanceof Error ? e.message : e);
  return m.includes("403")
    ? "La integración no tiene permiso para leer comentarios: activá «Leer comentarios» en notion.so/profile/integrations → Plataforma Yourebrand → Capacidades."
    : m.includes("404")
      ? "Notion no encuentra las páginas de clientes (404): conectá la integración a la página Yourebrand."
      : `Error al leer comentarios: ${m.slice(0, 160)}`;
}
const SIN_TOKEN_COMENTARIOS = "Falta conectar Notion (NOTION_TOKEN) para leer los comentarios.";

/** Todos los comentarios, del más viejo al más nuevo. Arma la lista con las cachés de cada cliente. */
export const getComentarios = cache(async function getComentarios(): Promise<DatosComentarios> {
  if (!process.env.NOTION_TOKEN) return { comentarios: [], motivo: SIN_TOKEN_COMENTARIOS };
  try {
    const { clientes } = await getDatos();
    const out: Comentario[] = [];
    // De a 3 clientes por vez para respetar el límite de la API de Notion (~3 pedidos por segundo) cuando no están en caché.
    for (let i = 0; i < clientes.length; i += 3) {
      const res = await Promise.all(clientes.slice(i, i + 3).map((c) => comentariosDe(c.id, c.notionUrl)));
      out.push(...res.flat());
    }
    return { comentarios: out.sort((a, b) => a.fecha.localeCompare(b.fecha)) };
  } catch (e) {
    console.error("[notion] No se pudieron leer los comentarios:", e);
    return { comentarios: [], motivo: motivoComentarios(e) };
  }
});

/** Comentarios de un solo cliente (del más nuevo al más viejo): un pedido a Notion, no los 34. */
export async function getComentariosCliente(id: string, notionUrl: string): Promise<DatosComentarios> {
  if (!process.env.NOTION_TOKEN) return { comentarios: [], motivo: SIN_TOKEN_COMENTARIOS };
  try {
    return { comentarios: [...(await comentariosDe(id, notionUrl))].sort((a, b) => b.fecha.localeCompare(a.fecha)) };
  } catch (e) {
    console.error("[notion] No se pudieron leer los comentarios del cliente:", e);
    return { comentarios: [], motivo: motivoComentarios(e) };
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
  ["mapa-calendarios-v2"],
  // Búsqueda cara (recorre los calendarios y sus páginas padre): se refresca en segundo plano cada hora.
  { revalidate: 3600, tags: [TAG_MAPA_CALENDARIOS] },
);

/** Publicaciones de un calendario. Se etiqueta con el id de la fuente y de la base para que el webhook lo invalide justo. */
// Los links de imágenes de Notion vencen a la hora: la clave cambia cada 45 minutos para no servir nunca imágenes vencidas.
const tramoDeLinks = () => Math.floor(Date.now() / (45 * 60_000));
const calendarioDe = (cal: { ds: string; db: string | null }) =>
  unstable_cache(() => leerCalendario(cal.ds), ["calendario-v2", cal.ds, String(tramoDeLinks())], {
    revalidate: 120,
    tags: [TAG_CALENDARIO, tagCalendario(cal.ds), ...(cal.db ? [tagCalendario(cal.db)] : [])],
  })();

export async function getCalendario(notionUrl: string): Promise<DatosCalendario> {
  if (!process.env.NOTION_TOKEN) return { publicaciones: [], tieneCalendario: false, motivo: "Falta conectar Notion (NOTION_TOKEN) para ver el calendario." };
  try {
    const id = idDeUrl(notionUrl);
    const cal = id ? (await mapaCalendarios())[id] : undefined;
    if (!cal) return { publicaciones: [], tieneCalendario: false };
    return { publicaciones: await calendarioDe(cal), tieneCalendario: true };
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

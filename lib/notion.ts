// Lectura en vivo de las bases de Notion (API REST, versión con data sources).
// Si no hay NOTION_TOKEN, la plataforma usa los JSON de /data como respaldo.
import { unstable_cache } from "next/cache";
import type { Cliente } from "@/lib/clientes";
import type { AreaId, Caso, Persona } from "@/lib/equipo";

export const DS = {
  clientes: "0822fcc6-9457-4a70-8e6c-8160a4a8bf0b",
  nomina: "b88d4804-0158-4419-853f-8696f7169faa",
  casos: "9a6a6453-58b5-4b55-9fd1-dd77ba37d62b",
  // Dirección › Marketing - Publicidad › Reuniones de venta › "Funnel de venta"
  funnelVenta: "39dcc8a7-5766-4687-905d-c19effa21f19",
};

/* eslint-disable @typescript-eslint/no-explicit-any */
type Page = { id: string; url: string; created_time: string; properties: Record<string, any> };

/** fetch a Notion con reintentos: respeta el límite de la API (429) y reintenta errores 5xx. */
async function notionFetch(url: string, init: RequestInit): Promise<Response> {
  for (let intento = 0; ; intento++) {
    const r = await fetch(url, { ...init, cache: "no-store" });
    if ((r.status === 429 || r.status >= 500) && intento < 4) {
      const espera = Number(r.headers.get("retry-after")) * 1000 || 400 * 2 ** intento;
      await new Promise((ok) => setTimeout(ok, Math.min(espera, 5000)));
      continue;
    }
    return r;
  }
}

export async function queryDataSource(id: string, filter?: unknown): Promise<Page[]> {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error("Falta NOTION_TOKEN");
  const pages: Page[] = [];
  let cursor: string | undefined;
  do {
    const r = await notionFetch(`https://api.notion.com/v1/data_sources/${id}/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Notion-Version": "2025-09-03", "Content-Type": "application/json" },
      body: JSON.stringify({ page_size: 100, start_cursor: cursor, ...(filter ? { filter } : {}) }),
      cache: "no-store",
    });
    if (!r.ok) throw new Error(`Notion ${r.status}: ${await r.text()}`);
    const j = await r.json();
    pages.push(...j.results);
    cursor = j.has_more ? j.next_cursor : undefined;
  } while (cursor);
  return pages;
}

/* ---------- lectura de propiedades ---------- */
const prop = (p: Page, nombre: string) => p.properties[nombre] ?? p.properties[nombre.trim()] ?? p.properties[nombre + " "];
const texto = (v: any): string | null => {
  if (!v) return null;
  const arr = v.title ?? v.rich_text;
  if (arr) return arr.map((t: any) => t.plain_text).join("").trim() || null;
  if (v.type === "url") return v.url;
  if (v.type === "email") return v.email;
  if (v.type === "phone_number") return v.phone_number;
  return null;
};
const select = (v: any): string | null => v?.select?.name ?? v?.status?.name ?? null;
const multi = (v: any): string[] => (v?.multi_select ?? []).map((o: any) => o.name);
const fecha = (v: any): string | null => v?.date?.start?.slice(0, 10) ?? null;
const numero = (v: any): number | null => (typeof v?.number === "number" ? v.number : null);
const relacion = (v: any): string[] => (v?.relation ?? []).map((r: any) => sinGuiones(r.id));
const sinGuiones = (id: string) => id.replace(/-/g, "");

export function slug(s: string) {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/* ---------- Clientes ---------- */
function links(raw: string | null) {
  const out = { instagram: null as string | null, web: null as string | null, linkedin: null as string | null };
  for (const u of (raw ?? "").split(/\s+/).filter(Boolean)) {
    const ig = u.match(/instagram\.com\/([A-Za-z0-9._]+)/);
    if (ig) out.instagram = ig[1];
    else if (u.includes("linkedin")) out.linkedin = u;
    else out.web = u.replace(/\.$/, "");
  }
  return out;
}

export function mapCliente(p: Page, logos: Map<string, string | null>): Cliente & { notionId: string } {
  const nombre = texto(prop(p, "Nombre")) ?? "Sin nombre";
  const id = slug(nombre);
  const ars = numero(prop(p, "Paga mensual ars"));
  const eur = numero(prop(p, "Paga mensual (Euros)"));
  return {
    id,
    notionId: sinGuiones(p.id),
    nombre,
    estado: select(prop(p, "Estado 1")) === "Activo" ? "Activo" : "Inactivo",
    ...links(texto(prop(p, "Instagram"))),
    pais: select(prop(p, "Pais")),
    segmento: select(prop(p, "Segmento")),
    planes: multi(prop(p, "Planes")),
    rubros: multi(prop(p, "Rubro")),
    desde: fecha(prop(p, "Desde")),
    vencimiento: fecha(prop(p, "Vencimiento")),
    email: texto(prop(p, "Email")),
    telefono: texto(prop(p, "Numero Telefonico")),
    contacto: texto(prop(p, "Nombre del dueño")),
    pagoMensual: ars ? { monto: ars, moneda: "ARS" } : eur ? { monto: eur, moneda: "EUR" } : null,
    logo: logos.get(id) ?? null,
    notionUrl: p.url,
    satisfaccion: (select(prop(p, "Satisfaccion")) as Cliente["satisfaccion"]) ?? null,
    margen: numero(prop(p, "Margen contribucion")),
    ubicacion: multi(prop(p, "Ubicacion geografic") ?? prop(p, "Ubicacion geografica")),
  };
}

/* ---------- Casos ---------- */
export function mapCaso(p: Page, clientePorNotion: Map<string, string>): (Caso & { notionId: string; responsablesNotion: string[] }) | null {
  const etiquetas = multi(prop(p, "Etiquetas"));
  if (etiquetas.includes("Solucionado")) return null;
  const gravedad = (["URGENTE", "Grave", "Leve"] as const).find((g) => etiquetas.includes(g)) ?? "Leve";
  const c = relacion(prop(p, "Clientes"))[0];
  return {
    notionId: sinGuiones(p.id),
    titulo: (texto(prop(p, "Tipo de problema")) ?? "Caso").replace(/\s*\(\d+\)$/, ""),
    gravedad,
    cliente: (c && clientePorNotion.get(c)) || null,
    fecha: p.created_time.slice(0, 10),
    notionUrl: p.url,
    situacion: texto(prop(p, "Situacion")),
    responsablesNotion: relacion(prop(p, "Account manager")),
  };
}

/* ---------- Nómina ---------- */
// Roles de Notion → área del organigrama. Los cargos nuevos tienen prioridad si ya están cargados en Notion.
const AREA_POR_ROL: Record<string, AreaId> = {
  "The Owner": "direccion",
  "Owner · CEO": "direccion",
  RRHH: "rrhh",
  "Jefa de RRHH": "rrhh",
  Asistente: "asistencia",
  "Asistente personal": "asistencia",
  "Jefa creativa": "jefatura-creativa",
  "Community Manager": "cms",
  "Community Manager Senior": "cms",
  "Creador de Contenido": "ugc",
  "Editor de Video": "ugc",
  Publicista: "paid",
  "Desarrollador Web": "paid",
};
// Cargos definidos en el organigrama (nov 2026) que todavía no están en el campo "Rol" de Notion.
const CARGO_POR_PERSONA: Record<string, string> = {
  "Thomas Tripodi": "Owner · CEO",
  "Deborah Fernandez": "Jefa de RRHH",
  "Marcelo De Matos": "Asistente personal",
  "Agus Birarda": "Jefa creativa",
};

export function mapPersona(
  p: Page,
  clientePorNotion: Map<string, string>,
  casoPorNotion: Map<string, Caso>,
): Persona | null {
  const nombre = texto(prop(p, "Nombre"));
  const rolNotion = select(prop(p, "Rol"));
  if (!nombre || !rolNotion) return null;
  const rol = CARGO_POR_PERSONA[nombre] ?? rolNotion;
  const area = AREA_POR_ROL[rol] ?? AREA_POR_ROL[rolNotion];
  if (!area) return null;
  return {
    id: slug(nombre),
    nombre,
    rol,
    area,
    telefono: texto(prop(p, "Teléfono")),
    email: texto(prop(p, "Correo electrónico")),
    ingreso: fecha(prop(p, "Fecha de entrada")),
    clientes: relacion(prop(p, "Clientes")).map((id) => clientePorNotion.get(id)).filter(Boolean) as string[],
    casosAbiertos: relacion(prop(p, "Casos abiertos ")).map((id) => casoPorNotion.get(id)).filter(Boolean) as Caso[],
  };
}

/* ---------- Comentarios ---------- */
export type Comentario = {
  id: string;
  cliente: string; // id del cliente en la plataforma
  autor: string;
  autorId: string;
  texto: string;
  fecha: string; // ISO con hora
  notionUrl: string;
};

async function notionGet(path: string) {
  const r = await notionFetch(`https://api.notion.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${process.env.NOTION_TOKEN}`, "Notion-Version": "2025-09-03" },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Notion ${r.status}: ${await r.text()}`);
  return r.json();
}

/** Comentarios de una página (incluye los de bloques de la discusión principal de la página). */
export async function listarComentarios(pageId: string) {
  const out: any[] = [];
  let cursor: string | undefined;
  do {
    const j = await notionGet(`comments?block_id=${pageId}&page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`);
    out.push(...j.results);
    cursor = j.has_more ? j.next_cursor : undefined;
  } while (cursor);
  return out;
}

const nombres = new Map<string, string>();
// Los nombres casi no cambian: caché compartida de un día (antes se pedían de nuevo en cada servidor que arrancaba).
const nombreDeNotion = (id: string) =>
  unstable_cache(
    async () => {
      try {
        const u = await notionGet(`users/${id}`);
        return (u.name as string | undefined) ?? (u.type === "bot" ? "Integración" : "Usuario de Notion");
      } catch {
        return "Usuario de Notion"; // sin permiso "Leer información de usuarios": queda el nombre genérico
      }
    },
    ["usuario-notion", id],
    { revalidate: 86_400 },
  )();
export async function nombreUsuario(id: string, sugerido?: string | null) {
  if (sugerido) return sugerido;
  if (!id) return "Usuario de Notion";
  if (!nombres.has(id)) nombres.set(id, await nombreDeNotion(id));
  return nombres.get(id)!;
}

export function idDeUrl(url: string) {
  return url.match(/([0-9a-f]{32})(?:\?|$)/)?.[1] ?? url.replace(/-/g, "").match(/[0-9a-f]{32}/)?.[0] ?? null;
}

export async function mapComentario(c: any, cliente: { id: string; notionUrl: string }): Promise<Comentario> {
  return {
    id: c.id,
    cliente: cliente.id,
    autorId: c.created_by?.id ?? "",
    autor: await nombreUsuario(c.created_by?.id ?? "", c.display_name?.resolved_name),
    texto: (c.rich_text ?? []).map((t: any) => t.plain_text).join("").trim(),
    fecha: c.created_time,
    notionUrl: `${cliente.notionUrl.split("#")[0]}${c.discussion_id ? `?d=${c.discussion_id.replace(/-/g, "")}` : ""}`,
  };
}

/* ---------- Calendarios de contenido ---------- */
export type Publicacion = {
  id: string;
  titulo: string;
  fecha: string | null; // YYYY-MM-DD o ISO con hora
  estado: string | null;
  colorEstado: string | null; // color de la opción en Notion (red, green, ...)
  copy: string | null;
  url: string | null; // link de Drive u otro
  archivos: { nombre: string; url: string; imagen: boolean }[];
  notionUrl: string;
};

async function notionPost(path: string, body: unknown) {
  const r = await notionFetch(`https://api.notion.com/v1/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.NOTION_TOKEN}`, "Notion-Version": "2025-09-03", "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Notion ${r.status}: ${await r.text()}`);
  return r.json();
}

/** Busca todas las bases "Calendario mensual…" y las asocia al cliente que las contiene (aunque estén en subpáginas). */
export async function mapearCalendarios(idsClientes: Set<string>): Promise<Map<string, { ds: string; db: string | null }>> {
  const fuentes: any[] = [];
  let cursor: string | undefined;
  do {
    const j = await notionPost("search", { query: "Calendario mensual", filter: { property: "object", value: "data_source" }, page_size: 100, start_cursor: cursor });
    fuentes.push(...j.results);
    cursor = j.has_more ? j.next_cursor : undefined;
  } while (cursor);

  // Se guarda la promesa (no el valor) para que dos calendarios que comparten padre no lo pidan dos veces en paralelo.
  const cachePadre = new Map<string, Promise<any>>();
  const padreDe = (p: any): Promise<any> => {
    if (!p) return Promise.resolve(null);
    const id = p.page_id ?? p.block_id ?? p.database_id ?? null;
    if (!id) return Promise.resolve(null);
    const k = `${p.type}:${id}`;
    if (!cachePadre.has(k)) {
      const ruta = p.type === "page_id" ? `pages/${id}` : p.type === "block_id" ? `blocks/${id}` : `databases/${id}`;
      cachePadre.set(k, notionGet(ruta).then((j) => j?.parent ?? null, () => null));
    }
    return cachePadre.get(k)!;
  };

  const resultado = new Map<string, { ds: string; db: string | null; editado: string }>();
  const calendarios = fuentes.filter((f) => /calendario mensual/i.test((f.title ?? []).map((t: any) => t.plain_text).join("")) && !f.in_trash && !f.archived);
  const ubicar = async (f: any) => {
    let p = f.database_parent ?? (await padreDe(f.parent));
    for (let salto = 0; p && salto < 8; salto++) {
      const id = (p.page_id ?? p.block_id ?? "").replace(/-/g, "");
      if (p.type === "page_id" && idsClientes.has(id)) {
        const prev = resultado.get(id);
        if (!prev || f.last_edited_time > prev.editado) resultado.set(id, { ds: f.id, db: f.parent?.database_id ?? null, editado: f.last_edited_time });
        break;
      }
      if (p.type === "workspace") break;
      p = await padreDe(p);
    }
  };
  // 3 calendarios a la vez (el límite de Notion es ~3 pedidos por segundo; los 429 se reintentan).
  // Antes iban de a uno y la búsqueda completa podía tardar más de 30 segundos.
  let siguiente = 0;
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (siguiente < calendarios.length) await ubicar(calendarios[siguiente++]);
    }),
  );
  return new Map([...resultado].map(([k, v]) => [k, { ds: v.ds, db: v.db }]));
}

export async function leerCalendario(dataSourceId: string): Promise<Publicacion[]> {
  const pages = await queryDataSource(dataSourceId);
  return pages.map((p) => {
    const est = prop(p, "Estado");
    const archivos = (prop(p, "Archivos multimedia")?.files ?? []).map((f: any) => {
      const url = f.file?.url ?? f.external?.url ?? "";
      return { nombre: f.name ?? "archivo", url, imagen: /\.(png|jpe?g|gif|webp|avif|heic)(\?|$)/i.test(f.name ?? "") || /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(url) };
    });
    return {
      id: p.id,
      titulo: texto(prop(p, "Nombre")) ?? "Sin título",
      fecha: prop(p, "Fecha")?.date?.start ?? null,
      estado: est?.select?.name ?? est?.status?.name ?? null,
      colorEstado: est?.select?.color ?? est?.status?.color ?? null,
      copy: texto(prop(p, "Copy")),
      url: prop(p, "Url")?.url ?? null,
      archivos: archivos.filter((a: { url: string }) => a.url),
      notionUrl: p.url,
    };
  });
}

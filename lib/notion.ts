// Lectura en vivo de las bases de Notion (API REST, versión con data sources).
// Si no hay NOTION_TOKEN, la plataforma usa los JSON de /data como respaldo.
import type { Cliente } from "@/lib/clientes";
import type { AreaId, Caso, Persona } from "@/lib/equipo";

export const DS = {
  clientes: "0822fcc6-9457-4a70-8e6c-8160a4a8bf0b",
  nomina: "b88d4804-0158-4419-853f-8696f7169faa",
  casos: "9a6a6453-58b5-4b55-9fd1-dd77ba37d62b",
};

/* eslint-disable @typescript-eslint/no-explicit-any */
type Page = { id: string; url: string; created_time: string; properties: Record<string, any> };

export async function queryDataSource(id: string, filter?: unknown): Promise<Page[]> {
  const token = process.env.NOTION_TOKEN;
  if (!token) throw new Error("Falta NOTION_TOKEN");
  const pages: Page[] = [];
  let cursor: string | undefined;
  do {
    const r = await fetch(`https://api.notion.com/v1/data_sources/${id}/query`, {
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
  };
}

/* ---------- Casos ---------- */
export function mapCaso(p: Page, clientePorNotion: Map<string, string>): (Caso & { notionId: string }) | null {
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

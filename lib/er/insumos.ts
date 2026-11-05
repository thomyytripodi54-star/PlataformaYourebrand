import "server-only";
import { DS, queryDataSource } from "@/lib/notion";
import type { ClienteNotion } from "./motor";

/* eslint-disable @typescript-eslint/no-explicit-any */
const DS_VENCIMIENTOS = "24d029cc-0dee-8078-a672-000b263f9b2e";

const txt = (v: any): string => (v?.title ?? v?.rich_text ?? []).map((t: any) => t.plain_text).join("").trim();
const sel = (v: any): string | null => v?.select?.name ?? v?.status?.name ?? null;
const multi = (v: any): string[] => (v?.multi_select ?? []).map((o: any) => o.name);
const fecha = (v: any): string | null => v?.date?.start?.slice(0, 10) ?? null;
const numero = (v: any): number | null => (typeof v?.number === "number" ? v.number : null);

// Apodos que Thomy usa en el Excel (skill, paso 2)
const APODOS: Record<string, string[]> = {
  "deborah fernandez": ["debu"],
  "marcelo de matos": ["marce"],
  "brisa vallejos": ["bri"],
  "victoria calisaya": ["viky"],
  "julieta calvo": ["juli"],
  "macarena llaneza": ["maca"],
  "camila aurello": ["cami"],
  "valentin julio soraggi": ["valen"],
  "matias jerez": ["mati"],
  "agus birarda": ["agus"],
  "evangelina rost": ["eva", "evi"],
  "thomas tripodi": ["thomy"],
  "estefania carfi": ["estefi", "tefy"],
};
const sinTildes = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** roles.json: {"alias en minúscula": "Rol de Notion"} */
export async function rolesDesdeNotion() {
  const pages = await queryDataSource(DS.nomina);
  const roles: Record<string, string> = {};
  for (const p of pages) {
    const nombre = sinTildes(txt(p.properties["Nombre"]));
    const rol = sel(p.properties["Rol"]);
    if (!nombre || !rol) continue;
    roles[nombre] = rol;
    const primero = nombre.split(" ")[0];
    if (!roles[primero]) roles[primero] = rol;
    for (const a of APODOS[nombre] ?? []) roles[a] = rol;
  }
  return roles;
}

const duracionDePlanes = (planes: string[]) => (planes.includes("Anual") ? 12 : planes.includes("Semestral") ? 6 : planes.includes("Trimestral") ? 3 : 1);
const soloWeb = (planes: string[]) => planes.length > 0 && planes.every((p) => p === "Web");

export type ClienteCompleto = {
  nombre: string;
  estado: string | null;
  pagaArs: number | null;
  pagaEur: number | null;
  margen: number | null;
  planes: string[];
  desde: string | null;
  baja: string | null;
};

export async function clientesDesdeNotion(): Promise<ClienteCompleto[]> {
  const pages = await queryDataSource(DS.clientes);
  return pages.map((p) => ({
    nombre: txt(p.properties["Nombre"]),
    estado: sel(p.properties["Estado 1"]),
    pagaArs: numero(p.properties["Paga mensual ars"]),
    pagaEur: numero(p.properties["Paga mensual (Euros)"]),
    margen: numero(p.properties["Margen contribucion"]),
    planes: multi(p.properties["Planes"]),
    desde: fecha(p.properties["Desde"]),
    baja: fecha(p.properties["Fecha de baja"]),
  }));
}

/** clientes.json para el script: activos + bajas de los últimos 3 meses. */
export function clientesParaMotor(cs: ClienteCompleto[], anio: number, mes: number): ClienteNotion[] {
  const hace3 = new Date(Date.UTC(anio, mes - 4, 1)).toISOString().slice(0, 10);
  return cs
    .filter((c) => c.nombre && (c.estado === "Activo" || (c.baja && c.baja >= hace3)))
    .map((c) => ({ alias: [c.nombre], paga_ars: c.pagaArs, paga_eur: c.pagaEur, duracion: duracionDePlanes(c.planes), desde: c.desde }));
}

/** Recurrencias, contribución marginal, entradas, bajas y clientes a fin de mes (skill, paso 6). */
export async function metricasDelMes(cs: ClienteCompleto[], anio: number, mes: number, euro: number) {
  const ini = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const fin = new Date(Date.UTC(anio, mes, 0)).toISOString().slice(0, 10);
  const enMes = (f: string | null) => !!f && f >= ini && f <= fin;

  // Con abono activos a fin de mes: sin las bajas del mes, sin los que entran después, sin webs puntuales ni clientes sin precio
  const activos = cs.filter(
    (c) => c.estado === "Activo" && (!c.desde || c.desde <= fin) && !(c.baja && c.baja <= fin) && !soloWeb(c.planes) && (c.pagaArs || c.pagaEur),
  );
  const sinPrecio = cs.filter((c) => c.estado === "Activo" && (!c.desde || c.desde <= fin) && !soloWeb(c.planes) && !c.pagaArs && !c.pagaEur).map((c) => c.nombre);
  const entradas = cs.filter((c) => enMes(c.desde) && !soloWeb(c.planes)).map((c) => c.nombre);

  // Bajas: Vencimientos del mes (Seleccionar = Baja) + Fecha de baja de Clientes
  const bajasClientes = cs.filter((c) => enMes(c.baja)).map((c) => c.nombre);
  let bajasVenc: string[] | null = null;
  try {
    const venc = await queryDataSource(DS_VENCIMIENTOS);
    bajasVenc = venc.filter((p) => sel(p.properties["Seleccionar"]) === "Baja" && enMes(fecha(p.properties["Fecha de Vencimiento"]))).map((p) => txt(p.properties["Nombre"]));
  } catch {
    bajasVenc = null; // la integración puede no tener acceso a "Operativo"
  }
  const bajas = [...new Set([...(bajasVenc ?? []), ...bajasClientes])];

  return {
    recurrenciasArs: activos.reduce((s, c) => s + (c.pagaArs ?? 0), 0),
    recurrenciasEurEnArs: activos.reduce((s, c) => s + (c.pagaEur ?? 0), 0) * euro,
    margenArs: activos.reduce((s, c) => s + (c.margen ?? 0), 0),
    clientes: activos.length,
    clientesNombres: activos.map((c) => c.nombre),
    entradas,
    bajas,
    bajasVencimientos: bajasVenc,
    bajasClientes,
    sinPrecio,
  };
}
export type MetricasMes = Awaited<ReturnType<typeof metricasDelMes>>;

/** Dólar blue del día: promedio entre compra y venta (skill, paso 6). */
export async function dolarBlue() {
  const r = await fetch("https://dolarapi.com/v1/dolares/blue", { cache: "no-store" });
  if (!r.ok) throw new Error(`dolarapi.com respondió ${r.status}`);
  const j = (await r.json()) as { compra: number; venta: number; fechaActualizacion: string };
  return { compra: j.compra, venta: j.venta, valor: (j.compra + j.venta) / 2, fuente: `Dólar blue (dolarapi.com), compra ${j.compra} / venta ${j.venta}, ${j.fechaActualizacion.slice(0, 16).replace("T", " ")}` };
}

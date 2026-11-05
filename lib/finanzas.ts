import data from "@/data/finanzas/estado-resultados.json";

/* ---------- Modelo ---------- */
export type EstadoMes = "sin_datos" | "pendiente" | "borrador" | "consolidado";

export type MesER = {
  anio: number;
  mes: number; // 1-12
  estado: EstadoMes;
  fuente: string;
  dolar: number;
  dolarFuente: string;
  ingresos: { rrssMens: number; rrssTrim: number; rrssSems: number; rrssAnual: number; extras: number };
  /** Hasta junio 2026, CM y Producción iban juntos en "communityManagers" (produccion = null). */
  costosOperativos: { communityManagers: number; produccion: number | null; desarrolloWeb: number; publicidad: number };
  costosFijos: { campanas: number; organico: number; sueldoMarketing: number; sueldosFijos: number; suscripciones: number; sueldoThomy: number };
  extras: number;
  impuestos: number;
  fees: number;
  recurrencias: { ars: number; eurEnArs: number };
  contMarginalUsd: number | null;
  margenSinWebs: number | null;
  clientes: number;
  entradas: number;
  bajas: number;
  analisis: string[];
  objetivos: string[];
  mejoras: string[];
  ajustes: string[];
  revisar: string[];
};

export const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export const meses = data as MesER[];

/* ---------- Totales (siempre calculados, nunca cargados a mano) ---------- */
const suma = (o: Record<string, number | null>) => Object.values(o).reduce<number>((s, v) => s + (v ?? 0), 0);

export function totales(m: MesER) {
  const ingresosBrutos = suma(m.ingresos);
  const costosOperativos = suma(m.costosOperativos);
  const margenOperativo = ingresosBrutos - costosOperativos;
  const costosFijos = suma(m.costosFijos);
  const ebitda = margenOperativo - costosFijos - m.extras;
  const utilidadNeta = ebitda - m.impuestos - m.fees;
  const pct = (v: number) => (ingresosBrutos ? v / ingresosBrutos : 0);
  const usd = (v: number) => v / m.dolar;
  return {
    ingresosBrutos,
    costosOperativos,
    margenOperativo,
    costosFijos,
    ebitda,
    utilidadNeta,
    margenPct: pct(margenOperativo),
    utilidadPct: pct(utilidadNeta),
    ingresosUsd: usd(ingresosBrutos),
    utilidadUsd: usd(utilidadNeta),
    recurrenciaTotal: m.recurrencias.ars + m.recurrencias.eurEnArs,
    pct,
    usd,
  };
}
export type Totales = ReturnType<typeof totales>;

/* ---------- Trimestres y año (agregados) ---------- */
export const trimestreDe = (mes: number) => Math.ceil(mes / 3);

export function agregar(lista: MesER[]) {
  const t = lista.map(totales);
  const s = (f: (x: Totales) => number) => t.reduce((a, x) => a + f(x), 0);
  const ingresos = s((x) => x.ingresosBrutos);
  const ingresosUsd = s((x) => x.ingresosUsd);
  const utilidadUsd = s((x) => x.utilidadUsd);
  return {
    meses: lista.length,
    ingresos,
    ingresosUsd,
    margen: s((x) => x.margenOperativo),
    margenPct: ingresos ? s((x) => x.margenOperativo) / ingresos : 0,
    utilidad: s((x) => x.utilidadNeta),
    utilidadUsd,
    utilidadPct: ingresos ? s((x) => x.utilidadNeta) / ingresos : 0,
    costosFijos: s((x) => x.costosFijos),
    extras: lista.reduce((a, m) => a + m.extras, 0),
    entradas: lista.reduce((a, m) => a + m.entradas, 0),
    bajas: lista.reduce((a, m) => a + m.bajas, 0),
    clientesFinal: lista.at(-1)?.clientes ?? 0,
    promedioIngresosUsd: lista.length ? ingresosUsd / lista.length : 0,
    promedioUtilidadUsd: lista.length ? utilidadUsd / lista.length : 0,
    tendenciaUtilidadUsd: t.map((x) => x.utilidadUsd),
  };
}
export type Agregado = ReturnType<typeof agregar>;

/* ---------- Alerta de consolidación ---------- */
export const DIA_LIMITE = Number(process.env.NEXT_PUBLIC_DIA_LIMITE_ER ?? 10);

/** Fecha de hoy en Buenos Aires. */
export function hoyBA(ahora = new Date()) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(ahora);
  const [y, m, d] = p.split("-").map(Number);
  return { anio: y, mes: m, dia: d };
}

/**
 * Desde el día 1 del mes M, si M−1 no está consolidado queda pendiente.
 * Pasado el día límite (10 por defecto) se marca como atrasado.
 */
export function mesPendiente(lista: MesER[] = meses, ahora = new Date(), diaLimite = DIA_LIMITE) {
  const h = hoyBA(ahora);
  const anio = h.mes === 1 ? h.anio - 1 : h.anio;
  const mes = h.mes === 1 ? 12 : h.mes - 1;
  const m = lista.find((x) => x.anio === anio && x.mes === mes);
  if (m?.estado === "consolidado") return null;
  return { anio, mes, atrasado: h.dia > diaLimite, dia: h.dia, diaLimite };
}

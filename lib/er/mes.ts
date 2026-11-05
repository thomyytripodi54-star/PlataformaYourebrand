/** Del resultado de la skill a un mes del ER. Puro: se usa en el servidor y en la pantalla de revisión. */
import { MESES, totales, type MesER } from "@/lib/finanzas";
import type { Ajustes, ResultadoER } from "./motor";
import type { MetricasMes } from "./insumos";

export const SHEET_ID = "1cDu6BbGmY8HiFB2LBEHuq1ZmTt-iJ9cFvZcHc1JXKLE";
// Pestañas existentes de "Yourebrand Finanzas" (gid)
const GIDS: Record<string, number> = {
  "2026-1": 336649997, "2026-2": 1331261377, "2026-3": 1336791681, "2026-4": 1574221844, "2026-5": 245620777, "2026-6": 1301526054,
  "2026-7": 445107571, "2026-8": 1396262686, "2026-9": 2141068958, "2026-10": 2141069100,
};
export const fuenteUrlDe = (anio: number, mes: number) =>
  GIDS[`${anio}-${mes}`] ? `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${GIDS[`${anio}-${mes}`]}` : `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;

/** Ítems a revisar: cada renglón que la skill marcó con "?". */
export const claveItem = (d: { fila: number | "+"; nombre: string; tipo: string }) => `${d.fila}|${d.nombre}|${d.tipo}`;
export type Resoluciones = Record<string, { linea: string; confirmado: boolean }>;

export function itemsRevisar(er: ResultadoER) {
  return er.detalle.filter((d) => d.revisar);
}

/** Diferencia contra el "Calculo diferido" del Excel y cuánto queda sin explicar. */
export function control(er: ResultadoER, explicaciones: { monto: number }[] = []) {
  const excel = er.control_excel?.res ?? null;
  const dif = excel === null ? 0 : er.utilidad_neta - excel;
  const explicado = er.explicado.reduce((s, x) => s + x.monto, 0) + explicaciones.reduce((s, x) => s + x.monto, 0);
  return { excel, dif, explicado, sinExplicar: dif - explicado };
}

/** null si se puede confirmar; si no, el motivo. */
export function validarConfirmacion(er: ResultadoER, res: Resoluciones, explicaciones: { concepto: string; monto: number }[]) {
  const pendientes = itemsRevisar(er).filter((d) => !res[claveItem(d)]?.confirmado);
  if (pendientes.length) return `Faltan resolver ${pendientes.length} ítem(s) de la lista REVISAR.`;
  const c = control(er, explicaciones);
  if (c.excel !== null && Math.abs(c.sinExplicar) > 2) return `Queda una diferencia sin explicar de ${Math.round(c.sinExplicar).toLocaleString("es-AR")} ARS contra el "Calculo diferido" del Excel.`;
  return null;
}

type BorradorMin = { anio: number; mes: number; archivo: string; dolar: { valor: number; fuente: string }; metricas: MetricasMes };

export function armarMes(b: BorradorMin, er: ResultadoER, ajustes: Ajustes, res: Resoluciones, explicaciones: { concepto: string; monto: number }[], anterior?: MesER): MesER {
  const L = er.lineas;
  const m: MesER = {
    anio: b.anio,
    mes: b.mes,
    estado: "consolidado",
    fuente: `Excel "${b.archivo}" (BALANCE) · consolidado en la plataforma con la skill`,
    fuenteUrl: fuenteUrlDe(b.anio, b.mes),
    dolar: b.dolar.valor,
    dolarFuente: b.dolar.fuente,
    ingresos: { rrssMens: L["RRSS Mens"], rrssTrim: L["RRSS Trim diferidos"], rrssSems: L["RRSS Sems diferidos"], rrssAnual: L["RRSS Anual diferidos"], extras: L["Extras ingreso"] },
    costosOperativos: { communityManagers: L["Community Managers"], produccion: L["Produccion de contenido"], desarrolloWeb: L["Desarrollo web"], publicidad: L["Publicidad"] },
    costosFijos: { campanas: L["Gastos campañas"], organico: L["Gasto redes organico"], sueldoMarketing: L["Sueldo marketing"], sueldosFijos: L["Sueldos Fijos"], suscripciones: L["Suscripciones"], sueldoThomy: L["Sueldo Thomy"] },
    extras: L["Extras"],
    impuestos: L["Impuestos"],
    fees: L["Fees"],
    recurrencias: { ars: b.metricas.recurrenciasArs, eurEnArs: b.metricas.recurrenciasEurEnArs },
    contMarginalUsd: b.metricas.margenArs / b.dolar.valor,
    margenSinWebs: null,
    clientes: b.metricas.clientes,
    entradas: b.metricas.entradas.length,
    bajas: b.metricas.bajas.length,
    analisis: [],
    objetivos: [],
    mejoras: [],
    ajustes: [
      ...er.explicado.map((x) => `${x.concepto}: ${x.monto >= 0 ? "+" : ""}${Math.round(x.monto).toLocaleString("es-AR")}`),
      ...Object.entries(ajustes.filas ?? {}).map(([f, l]) => `Fila ${f} reclasificada a ${l}`),
      ...explicaciones.map((x) => `${x.concepto}: ${Math.round(x.monto).toLocaleString("es-AR")} (explicación)`),
    ],
    revisar: itemsRevisar(er).map((d) => `F${d.fila} ${d.nombre} → ${res[claveItem(d)]?.linea ?? d.linea} (${d.nota})`),
  };
  m.analisis = analisisBorrador(m, anterior);
  return m;
}

/** 3-4 bullets con el estilo de Thomy, comparando contra el mes anterior. */
export function analisisBorrador(m: MesER, a?: MesER) {
  const t = totales(m);
  const pct = (x: number) => `${(x * 100).toFixed(1).replace(".", ",")}%`;
  const usd = (x: number) => `USD ${Math.round(x).toLocaleString("es-AR")}`;
  const out = [`(Borrador Claude) Utilidad neta ${usd(t.utilidadUsd)} (${pct(t.utilidadPct)}) con dólar blue ${Math.round(m.dolar).toLocaleString("es-AR")}`];
  if (a) {
    const ta = totales(a);
    const v = (x: number, y: number) => `${x >= y ? "+" : ""}${Math.round(((x - y) / Math.abs(y || 1)) * 100)}%`;
    out.push(`Ingresos brutos ${usd(t.ingresosUsd)} (${v(t.ingresosUsd, ta.ingresosUsd)} vs ${MESES[a.mes - 1].toLowerCase()}): ${m.entradas} entradas y ${m.bajas} bajas`);
    out.push(`Margen operativo ${pct(t.margenPct)} (${pct(ta.margenPct)} el mes anterior)`);
    out.push(`Costos fijos ${pct(t.pct(t.costosFijos))} de los ingresos (${pct(ta.pct(ta.costosFijos))} el mes anterior)`);
  }
  return out;
}

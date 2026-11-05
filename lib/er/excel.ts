/**
 * Lectura de la hoja BALANCE, igual que `bloques()` y `leer()` de er_mes.py.
 * openpyxl lee dos veces el libro (fórmulas y valores cacheados); acá ExcelJS da las dos cosas por celda.
 */
import ExcelJS from "exceljs";
import { MESES_ER, norm, type Bloque, type Renglon } from "./motor";

type Celda = { valor: unknown; formula: string | null };

function leerCelda(ws: ExcelJS.Worksheet, r: number, c: number): Celda {
  const cell = ws.getCell(r, c);
  const v = cell.value as unknown;
  const formula = cell.formula ? "=" + cell.formula : null;
  if (v && typeof v === "object" && !(v instanceof Date)) {
    const o = v as { result?: unknown; richText?: { text: string }[]; text?: string; error?: string };
    if ("result" in o || formula) return { valor: o.result ?? null, formula };
    if (o.richText) return { valor: o.richText.map((t) => t.text).join(""), formula: null };
    if (o.text !== undefined) return { valor: o.text, formula: null };
    if (o.error) return { valor: o.error, formula: null };
  }
  return { valor: v ?? null, formula };
}
/** wf.cell().value de openpyxl: la fórmula si la hay, si no el valor. */
const formulaOValor = (c: Celda) => c.formula ?? c.valor;
/** num() del script: solo números (no booleanos). */
const num = (v: unknown) => (typeof v === "number" ? v : 0);

export async function abrirBalance(buffer: ArrayBuffer | Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as ArrayBuffer);
  const ws = wb.getWorksheet("BALANCE");
  if (!ws) throw new Error("El archivo no tiene la hoja BALANCE.");
  return ws;
}

export function bloques(ws: ExcelJS.Worksheet, anioUltimo: number) {
  const bs: { col: number; mes: number; anio?: number }[] = [];
  for (let c = 1; c <= ws.columnCount; c++) {
    const v = norm(formulaOValor(leerCelda(ws, 23, c))).replace("setiembre", "septiembre");
    const i = MESES_ER.indexOf(v);
    if (i >= 0) bs.push({ col: c, mes: i });
  }
  let a = anioUltimo;
  for (let i = bs.length - 1; i >= 0; i--) {
    if (i < bs.length - 1 && bs[i].mes >= bs[i + 1].mes) a -= 1;
    bs[i].anio = a;
  }
  return bs as { col: number; mes: number; anio: number }[];
}

export function leerBloque(ws: ExcelJS.Worksheet, c: number): { rows: Renglon[] | null; meta: Bloque["meta"] } {
  let ft: number | null = null;
  for (let r = 24; r < 400; r++) {
    if (String(formulaOValor(leerCelda(ws, r, c + 1)) ?? "").toUpperCase().startsWith("=SUM(")) {
      ft = r;
      break;
    }
  }
  const meta: Bloque["meta"] = {
    usd: num(leerCelda(ws, 26, c + 4).valor),
    eur: num(leerCelda(ws, 24, c + 4).valor),
    bajas: leerCelda(ws, 25, c + 6).valor,
    nuevos: leerCelda(ws, 25, c + 7).valor,
    calc: null,
  };
  if (ft === null) return { rows: null, meta };
  const rows: Renglon[] = [];
  for (let r = 24; r < ft; r++) {
    let [ing, egr, dif] = [1, 2, 3].map((i) => num(leerCelda(ws, r, c + i).valor));
    ing = Math.abs(ing) <= 1 ? 0 : ing;
    dif = Math.abs(dif) <= 1 ? 0 : dif;
    egr = Math.abs(egr) <= 1 ? 0 : egr;
    if (ing || egr || dif) {
      const fe = leerCelda(ws, r, c + 2);
      const fd = leerCelda(ws, r, c + 3);
      rows.push({
        fila: r,
        nombre: String(leerCelda(ws, r, c).valor ?? "").trim(),
        ing,
        egr,
        dif,
        fEgr: formulaOValor(fe) === null ? null : String(formulaOValor(fe)),
        fDif: formulaOValor(fd) === null ? null : String(formulaOValor(fd)),
      });
    }
  }
  for (let r = ft; r < ft + 8; r++) {
    if (norm(leerCelda(ws, r, c).valor).includes("diferido")) {
      meta.calc = { ing: num(leerCelda(ws, r, c + 1).valor), egr: num(leerCelda(ws, r, c + 2).valor), res: num(leerCelda(ws, r, c + 3).valor) };
    }
  }
  return { rows, meta };
}

/** Lee el mes pedido y los 13 anteriores (lo que usa el script). */
export function leerInsumos(ws: ExcelJS.Worksheet, mes: number /* 1-12 */, anio: number, anioUltimo = anio) {
  const bs = bloques(ws, anioUltimo);
  const idx = bs.findIndex((b) => b.mes === mes - 1 && b.anio === anio);
  if (idx < 0) {
    const ult = bs.slice(-6).map((b) => `${MESES_ER[b.mes]} ${b.anio}`).join(", ");
    throw new Error(`No encontré el bloque de ${MESES_ER[mes - 1]} ${anio} en la fila 23 de BALANCE. Últimos bloques: ${ult || "ninguno"}.`);
  }
  const desde = Math.max(0, idx - 13);
  const out: Bloque[] = bs.slice(desde, idx + 1).map((b) => ({ ...b, ...leerBloque(ws, b.col) }));
  if (!out.at(-1)!.rows) throw new Error(`El bloque de ${MESES_ER[mes - 1]} ${anio} no tiene la fila =SUM.`);
  return { bloques: out, idx: out.length - 1 };
}

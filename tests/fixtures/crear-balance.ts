/** Genera un BALANCE de prueba (agosto → octubre 2026) con los casos difíciles de la skill. */
import ExcelJS from "exceljs";

type Fila = [nombre: string, ing?: number | { f: string; r: number }, egr?: number | { f: string; r: number }, dif?: number];
const v = (x: Fila[1]) => (x === undefined ? null : typeof x === "number" ? x : { formula: x.f.replace(/^=/, ""), result: x.r });

export async function crearBalance(ruta: string) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("BALANCE");
  const bloque = (col: number, mes: string, usd: number, eur: number, bajas: number, nuevos: number, filas: Fila[], calcRes?: number) => {
    ws.getCell(23, col).value = mes;
    ["Ingresos", "egresos", "Ing diferidos (violeta)", "EUR"].forEach((h, i) => (ws.getCell(23, col + 1 + i).value = h));
    ws.getCell(24, col + 4).value = eur;
    ws.getCell(26, col + 4).value = usd;
    ws.getCell(25, col + 6).value = bajas;
    ws.getCell(25, col + 7).value = nuevos;
    filas.forEach((f, i) => {
      const r = 24 + i;
      ws.getCell(r, col).value = f[0];
      ws.getCell(r, col + 1).value = v(f[1]) as ExcelJS.CellValue;
      ws.getCell(r, col + 2).value = v(f[2]) as ExcelJS.CellValue;
      ws.getCell(r, col + 3).value = (f[3] ?? null) as ExcelJS.CellValue;
    });
    const rs = 24 + filas.length;
    const L = (c: number) => ws.getColumn(c).letter;
    const tot = (k: 1 | 2 | 3) => filas.reduce((s, f) => s + (typeof f[k] === "number" ? (f[k] as number) : f[k] ? (f[k] as { r: number }).r : 0), 0);
    ws.getCell(rs, col + 1).value = { formula: `SUM(${L(col + 1)}24:${L(col + 1)}${rs - 1})`, result: tot(1) };
    ws.getCell(rs, col + 2).value = { formula: `SUM(${L(col + 2)}24:${L(col + 2)}${rs - 1})`, result: tot(2) };
    ws.getCell(rs, col + 3).value = { formula: `SUM(${L(col + 3)}24:${L(col + 3)}${rs - 1})`, result: tot(3) };
    ws.getCell(rs + 2, col).value = "Calculo diferido";
    ws.getCell(rs + 2, col + 3).value = calcRes ?? tot(1) - tot(2) + tot(3);
  };
  // Agosto: AQ paga trimestral 1.575.000 (cuota 525.000), Rafaela trimestral 2.355.000
  bloque(2, "Agosto", 1500, 1600, 8, 7, [
    ["AQ capital", 1_575_000, undefined, 525_000],
    ["Rafaela", 2_355_000, undefined, 785_000],
    ["Fedora", 960_000],
    ["Meet alfred", undefined, 466_000, -155_333],
    ["Lara", undefined, 400_000],
  ]);
  // Septiembre
  bloque(12, "Septiembre", 1520, 1650, 8, 7, [
    ["AQ capital", undefined, undefined, 525_000],
    ["Rafaela", undefined, undefined, 785_000],
    ["Fedora", 960_000],
    ["Meet alfred", undefined, undefined, -155_333],
    ["Viky", undefined, 650_000],
  ]);
  // Octubre: AQ en el Excel con precio nuevo (582.750) y falta el diferido de Rafaela
  bloque(22, "Octubre", 1550, 1680, 2, 8, [
    ["AQ capital", undefined, undefined, 582_750],
    ["Fedora", 960_000],
    ["Fedora", 300_000],
    ["Fir24", 2_136_000],
    ["Gema 3 videos", 180_000],
    ["Hakuna", 2_598_000, undefined, 866_000],
    ["Aeky", 420_000],
    ["Clientx nuevo", 500_000],
    ["Meet alfred", undefined, undefined, -155_334],
    ["Thomy", undefined, { f: "=1500*1545", r: 2_317_500 }],
    ["Bruno pack cuentas", undefined, 192_000],
    ["Bruno mitad fir", undefined, 618_000],
    ["Bruno", undefined, 135_000],
    ["Web bruno", undefined, 300_000],
    ["Debu", undefined, 795_000],
    ["Debu filmaker", undefined, 80_000],
    ["Marce", undefined, 795_000],
    ["Marce", undefined, 100_000],
    ["Viky", undefined, 650_000],
    ["Estefi", undefined, 120_000],
    ["Regalo tefy", undefined, 45_000],
    ["Debu capa lari", undefined, 60_000],
    ["Mati yb", undefined, 30_000],
    ["Agus contenido", undefined, 350_000],
    ["Monotributo", undefined, 120_000],
    ["Ger", undefined, 90_000],
    ["Claude", undefined, 34_000],
    ["Sales navigator", undefined, 80_000],
    ["Nicolasito", undefined, 70_000],
  ]);
  await wb.xlsx.writeFile(ruta);
}

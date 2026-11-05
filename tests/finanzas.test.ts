import { test } from "node:test";
import assert from "node:assert/strict";
import { agregar, meses as base, mesPendiente, totales, type MesER } from "@/lib/finanzas";
import octubre from "@/data/finanzas/respaldo-octubre-2026.json";

// Octubre está vaciado para la prueba de consolidación; acá se usa su respaldo.
const meses = [...base, octubre as MesER];

test("octubre 2026 da los números de la skill", () => {
  const oct = meses.find((m) => m.anio === 2026 && m.mes === 10)!;
  const t = totales(oct);
  assert.equal(t.ingresosBrutos, 23_957_710);
  assert.equal(t.utilidadNeta, 7_765_410);
  assert.equal((t.utilidadPct * 100).toFixed(2), "32.41");
  assert.equal((t.margenPct * 100).toFixed(2), "59.05");
});

test("los 10 meses importados cierran (ingresos − costos = utilidad)", () => {
  for (const m of meses) {
    const t = totales(m);
    assert.equal(t.ebitda - m.impuestos - m.fees, t.utilidadNeta, `mes ${m.mes}`);
  }
  assert.equal(meses.length, 10);
});

test("los trimestres son agregados de sus meses", () => {
  const q3 = agregar(meses.filter((m) => m.mes >= 7 && m.mes <= 9));
  assert.equal(q3.meses, 3);
  assert.equal(q3.utilidad, 2_453_000 + 3_559_000 + 4_272_200);
});

const consolidados = (hasta: number): MesER[] => meses.filter((m) => m.mes <= hasta);
const BA = (iso: string) => new Date(iso + "T12:00:00-03:00");

test("alerta: noviembre con octubre consolidado → sin pendiente", () => {
  assert.equal(mesPendiente(consolidados(10), BA("2026-11-05")), null);
});
test("alerta: 1 de diciembre sin noviembre → pendiente, no atrasado", () => {
  assert.deepEqual(
    { ...mesPendiente(consolidados(10), BA("2026-12-01"))! },
    { anio: 2026, mes: 11, atrasado: false, dia: 1, diaLimite: 10 },
  );
});
test("alerta: 11 de diciembre sin noviembre → atrasado", () => {
  assert.equal(mesPendiente(consolidados(10), BA("2026-12-11"))!.atrasado, true);
});
test("alerta: el día límite es configurable", () => {
  assert.equal(mesPendiente(consolidados(10), BA("2026-12-06"), 5)!.atrasado, true);
});
test("alerta: en enero mira diciembre del año anterior", () => {
  const p = mesPendiente(consolidados(10), BA("2027-01-02"))!;
  assert.deepEqual([p.anio, p.mes], [2026, 12]);
});
test("alerta: usa la hora de Buenos Aires (00:30 del 1/12 en BA ya cuenta)", () => {
  assert.ok(mesPendiente(consolidados(10), new Date("2026-12-01T03:30:00Z")));
  assert.equal(mesPendiente(consolidados(10), new Date("2026-12-01T02:30:00Z")), null);
});

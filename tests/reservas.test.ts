import { test } from "node:test";
import assert from "node:assert/strict";
import { combinar, composicion, reservasBase, totalDe, validarCarga } from "@/lib/reservas";

test("reservas de la planilla: totales de julio y octubre cierran con su desglose", () => {
  const jul = reservasBase.find((m) => m.mes === 7)!;
  const oct = reservasBase.find((m) => m.mes === 10)!;
  assert.equal(Math.round(totalDe(jul) * 100) / 100, 5928.57);
  assert.equal(Math.round(totalDe(oct) * 100) / 100, 12703.48);
});

test("composición: liquidez, invertido y deudas con signo", () => {
  const oct = combinar(reservasBase, []).find((m) => m.mes === 10)!;
  const c = composicion(oct);
  assert.equal(Math.round(c.liquidez * 100) / 100, 10441.94); // efectivo + banco + Meli
  assert.equal(Math.round(c.invertido * 100) / 100, 863.48); // Binance + IOL
  assert.equal(c.deudas, 1398.06);
  const jul = combinar(reservasBase, []).find((m) => m.mes === 7)!;
  assert.equal(composicion(jul).deudas, -1139);
});

test("lo cargado en la plataforma reemplaza al mes de la planilla y suma meses nuevos", () => {
  const nov = { anio: 2026, mes: 11, totalUsd: 0, cuentas: [{ nombre: "Banco", tipo: "banco" as const, montoUsd: 14000 }] };
  const oct = { anio: 2026, mes: 10, totalUsd: 0, cuentas: [{ nombre: "Banco", tipo: "banco" as const, montoUsd: 12000 }] };
  const todas = combinar(reservasBase, [nov, oct]);
  assert.equal(todas.length, 11);
  assert.equal(todas.at(-1)!.totalUsd, 14000);
  assert.equal(todas.find((m) => m.mes === 10)!.totalUsd, 12000);
});

test("validación de la carga", () => {
  assert.equal(validarCarga({ anio: 2026, mes: 13, cuentas: [] }), "Mes inválido.");
  assert.equal(validarCarga({ anio: 2026, mes: 11, cuentas: [] }), "Cargá al menos una cuenta.");
  assert.match(validarCarga({ anio: 2026, mes: 11, cuentas: [{ nombre: "Banco", tipo: "banco", montoUsd: -5 }] }) as string, /no puede ser negativo/);
  const ok = validarCarga({ anio: 2026, mes: 11, cuentas: [{ nombre: " Banco ", tipo: "banco", montoUsd: "100.456" }, { nombre: "Deudas", tipo: "deudas", montoUsd: -20 }], nota: "  " });
  assert.deepEqual(ok, { anio: 2026, mes: 11, cuentas: [{ nombre: "Banco", tipo: "banco", montoUsd: 100.46 }, { nombre: "Deudas", tipo: "deudas", montoUsd: -20 }], totalUsd: 80.46 });
});

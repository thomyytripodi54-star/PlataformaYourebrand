import { test } from "node:test";
import assert from "node:assert/strict";
import { pestanaComoTexto } from "@/lib/asistente/formato";

test("pestaña de la planilla como texto: saca vacíos y separa bloques", () => {
  const filas = [
    [],
    ["", "Resumen USD", "", "", "", "Octubre"],
    ["", "Dolar", "1551", "", "", "Ingresos", "ARS$", "%"],
    ["", "Clientes", "30", "", "$3.509,67", "Costos fijos totales"],
    ["", "", "", "", "", "", "", "", "", "", "- Comprar equipamiento"],
  ];
  assert.equal(
    pestanaComoTexto(filas),
    ["Resumen USD   ‖   Octubre", "Dolar | 1551   ‖   Ingresos | ARS$ | %", "Clientes | 30 |  | $3.509,67 | Costos fijos totales", "- Comprar equipamiento"].join("\n"),
  );
});

/** El port TypeScript tiene que dar EXACTAMENTE lo mismo que er_mes.py de la skill. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { crearBalance } from "./fixtures/crear-balance";
import { abrirBalance, leerInsumos } from "@/lib/er/excel";
import { calcularER } from "@/lib/er/motor";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "er-"));
const xlsx = path.join(dir, "balance.xlsx");
const fx = (f: string) => path.join(import.meta.dirname, "fixtures", f);
const roles = JSON.parse(fs.readFileSync(fx("roles.json"), "utf8"));
const clientes = JSON.parse(fs.readFileSync(fx("clientes.json"), "utf8"));

function python(extra: string[] = []) {
  const out = path.join(dir, `py-${Math.random()}.json`);
  execFileSync("python3", ["-I", path.join(import.meta.dirname, "..", "scripts/skill/er_mes.py"), xlsx, "Octubre", "2026", "--roles", fx("roles.json"), "--clientes", fx("clientes.json"), "--json", out, ...extra], { stdio: "pipe" });
  return JSON.parse(fs.readFileSync(out, "utf8"));
}
async function ts(ajustes = {}) {
  const ws = await abrirBalance(fs.readFileSync(xlsx));
  const { bloques, idx } = leerInsumos(ws, 10, 2026);
  return calcularER(bloques, idx, roles, clientes, ajustes);
}
const cerca = (a: number, b: number, msg: string) => assert.ok(Math.abs(a - b) < 0.005, `${msg}: TS ${a} vs Python ${b}`);

test("TS = Python: líneas, totales, revisar y detalle", async () => {
  await crearBalance(xlsx);
  const py = python();
  const t = await ts();
  for (const [k, val] of Object.entries(py.lineas as Record<string, number>)) cerca(t.lineas[k], val, k);
  for (const k of ["ingresos_brutos", "costos_operativos", "margen_operativo", "costos_fijos", "ebitda", "utilidad_neta"] as const) cerca(t[k], py[k], k);
  assert.deepEqual(t.revisar, py.revisar);
  assert.equal(t.detalle.length, py.detalle.length);
  t.detalle.forEach((d, i) => {
    const p = py.detalle[i];
    assert.equal(String(d.fila), String(p[0]), `fila ${i}`);
    assert.equal(d.linea, p[4], `línea de ${d.nombre}`);
    cerca(d.monto, p[3], `monto de ${d.nombre}`);
  });
});

test("TS = Python con ajustes (reclasificar una fila y agregar un renglón)", async () => {
  const aj = { filas: { "37": "Desarrollo web" }, agregar: [{ concepto: "Ajuste prueba", linea: "Extras", monto: 1000 }] };
  const f = path.join(dir, "aj.json");
  fs.writeFileSync(f, JSON.stringify(aj));
  const py = python(["--ajustes", f]);
  const t = await ts(aj);
  for (const [k, val] of Object.entries(py.lineas as Record<string, number>)) cerca(t.lineas[k], val, k);
  cerca(t.utilidad_neta, py.utilidad_neta, "utilidad");
});

test("casos de la skill: Rafaela faltante, AQ a lo cobrado, prepago Meet Alfred, Thomy y regalos", async () => {
  const t = await ts();
  const d = (n: string) => t.detalle.filter((x) => x.nombre.toLowerCase().includes(n));
  assert.ok(d("rafaela").some((x) => x.tipo === "cuota faltante" && Math.abs(x.monto - 785_000) < 1));
  assert.ok(d("aq capital").some((x) => Math.abs(x.monto - 525_000) < 1));
  assert.equal(d("meet").find((x) => x.tipo === "gasto diferido")?.linea, "Gastos campañas");
  assert.equal(d("thomy")[0].linea, "Sueldo Thomy");
  assert.equal(d("regalo")[0].linea, "Extras");
  assert.equal(d("capa lari")[0].linea, "Extras");
  assert.equal(d("ger")[0].linea, "Impuestos");
  assert.equal(d("bruno mitad")[0].linea, "Desarrollo web");
  assert.equal(d("bruno pack")[0].linea, "Sueldo marketing");
  assert.ok(t.revisar.some((r) => r.includes("Nicolasito")));
});

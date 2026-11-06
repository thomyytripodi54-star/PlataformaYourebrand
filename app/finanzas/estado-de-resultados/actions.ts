"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { COOKIE, sesionValida } from "@/lib/auth";
import { totales, type MesER } from "@/lib/finanzas";
import { guardarVersion, TAG_ER } from "@/lib/er/almacen";
import { todosLosMeses } from "@/lib/er/datos";
import { clientesDesdeNotion, clientesParaMotor, dolarBlue, metricasDelMes, rolesDesdeNotion, type MetricasMes } from "@/lib/er/insumos";
import { calcularER, type Ajustes, type Bloque, type ClienteNotion } from "@/lib/er/motor";
import { armarMes, validarConfirmacion, type Resoluciones } from "@/lib/er/mes";

export type Borrador = {
  anio: number;
  mes: number;
  archivo: string;
  bloques: Bloque[];
  idx: number;
  roles: Record<string, string>;
  clientes: ClienteNotion[];
  dolar: { valor: number; fuente: string; compra: number; venta: number };
  metricas: MetricasMes;
  generadoEn: string;
};
type Res<T> = { ok: true; data: T } | { ok: false; error: string };

async function soloDuenio() {
  // Hoy la plataforma tiene un único usuario (Thomy, dueño): la sesión válida es el control de acceso.
  if (!(await sesionValida((await cookies()).get(COOKIE)?.value))) throw new Error("Tu sesión venció. Volvé a ingresar.");
}

/** Lo que viaja desde el navegador: el Excel se lee del lado del cliente y solo se mandan los bloques que usa la skill. */
export type EntradaExcel = { anio: number; mes: number; archivo: string; bloques: Bloque[]; idx: number };

/** Paso 1-4 de la skill: con los bloques de BALANCE, trae Notion y el dólar, y deja todo listo para correr el script. */
export async function prepararBorrador(e: EntradaExcel): Promise<Res<Borrador>> {
  try {
    await soloDuenio();
    const { anio, mes, archivo, bloques, idx } = e;
    if (!(anio >= 2024 && mes >= 1 && mes <= 12)) return { ok: false, error: "Mes inválido." };
    if (!Array.isArray(bloques) || !bloques[idx]?.rows) return { ok: false, error: "No llegó el bloque del mes desde el Excel." };
    const insumos = { bloques, idx };

    if (process.env.ER_FIXTURES) {
      // Modo de prueba local (sin Notion ni internet): datos de tests/fixtures. Nunca activo en Vercel.
      const fs = await import("node:fs");
      const leer = (f: string) => JSON.parse(fs.readFileSync(`${process.env.ER_FIXTURES}/${f}`, "utf8"));
      const metricas: MetricasMes = { recurrenciasArs: 19_311_500, recurrenciasEurEnArs: 1_087_200, margenArs: 12_726_000, clientes: 30, clientesNombres: [], entradas: ["Fir24", "Hakuna Cafe"], bajas: ["Palace Gym"], bajasVencimientos: null, bajasClientes: ["Palace Gym"], sinPrecio: [] };
      return { ok: true, data: { anio, mes, archivo, ...insumos, roles: leer("roles.json"), clientes: leer("clientes.json"), dolar: { compra: 1540, venta: 1562, valor: 1551, fuente: "Prueba local (dólar fijo)" }, metricas, generadoEn: new Date().toISOString() } };
    }
    if (!process.env.NOTION_TOKEN) return { ok: false, error: "Falta NOTION_TOKEN: la skill necesita la Nómina y Clientes de Notion." };
    const [roles, cs, dolar] = await Promise.all([rolesDesdeNotion(), clientesDesdeNotion(), dolarBlue()]);
    const euro = bloques[idx].meta.eur;
    const metricas = await metricasDelMes(cs, anio, mes, euro);
    return {
      ok: true,
      data: { anio, mes, archivo, ...insumos, roles, clientes: clientesParaMotor(cs, anio, mes), dolar, metricas, generadoEn: new Date().toISOString() },
    };
  } catch (err) {
    console.error("[finanzas] prepararBorrador:", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Confirmar: se recalcula en el servidor, se valida y se guarda como versión nueva. */
export async function confirmarMes(b: Borrador, ajustes: Ajustes, resoluciones: Resoluciones, explicaciones: { concepto: string; monto: number }[]): Promise<Res<{ version: number }>> {
  try {
    await soloDuenio();
    const er = calcularER(b.bloques, b.idx, b.roles, b.clientes, ajustes);
    const problema = validarConfirmacion(er, resoluciones, explicaciones);
    if (problema) return { ok: false, error: problema };

    const meses = await todosLosMeses({ fresco: true });
    const anterior = meses.find((m) => (b.mes === 1 ? m.anio === b.anio - 1 && m.mes === 12 : m.anio === b.anio && m.mes === b.mes - 1));
    const mesER: MesER = armarMes(b, er, ajustes, resoluciones, explicaciones, anterior);
    const t = totales(mesER);
    const reg = await guardarVersion({
      mes: mesER,
      consolidadoPor: "Thomy",
      consolidadoEn: new Date().toISOString(),
      archivo: b.archivo,
      resultado: `Utilidad neta ${Math.round(t.utilidadNeta)} ARS (${(t.utilidadPct * 100).toFixed(2)}%)`,
    });
    revalidateTag(TAG_ER, { expire: 0 });
    revalidatePath("/", "layout");
    return { ok: true, data: { version: reg.version } };
  } catch (e) {
    console.error("[finanzas] confirmarMes:", e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { COOKIE, sesionValida } from "@/lib/auth";
import { totales, type MesER } from "@/lib/finanzas";
import { guardarVersion } from "@/lib/er/almacen";
import { todosLosMeses } from "@/lib/er/datos";
import { abrirBalance, leerInsumos } from "@/lib/er/excel";
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

/** Paso 1-4 de la skill: lee el Excel, trae Notion y el dólar, y corre el script. */
export async function prepararBorrador(form: FormData): Promise<Res<Borrador>> {
  try {
    await soloDuenio();
    const archivo = form.get("archivo");
    const anio = Number(form.get("anio"));
    const mes = Number(form.get("mes"));
    if (!(archivo instanceof File) || !archivo.name.toLowerCase().endsWith(".xlsx")) return { ok: false, error: "Subí el Excel de Yourebrand en formato .xlsx." };
    if (archivo.size > 25 * 1024 * 1024) return { ok: false, error: "El archivo pesa más de 25 MB." };
    if (!(anio >= 2024 && mes >= 1 && mes <= 12)) return { ok: false, error: "Mes inválido." };

    const ws = await abrirBalance(Buffer.from(await archivo.arrayBuffer()));
    // Si el Excel ya tiene meses del año siguiente, el último bloque es de ese año (--anio-ultimo).
    let insumos;
    try {
      insumos = leerInsumos(ws, mes, anio, anio);
    } catch {
      insumos = leerInsumos(ws, mes, anio, anio + 1);
    }

    if (process.env.ER_FIXTURES) {
      // Modo de prueba local (sin Notion ni internet): datos de tests/fixtures. Nunca activo en Vercel.
      const fs = await import("node:fs");
      const leer = (f: string) => JSON.parse(fs.readFileSync(`${process.env.ER_FIXTURES}/${f}`, "utf8"));
      const metricas: MetricasMes = { recurrenciasArs: 19_311_500, recurrenciasEurEnArs: 1_087_200, margenArs: 12_726_000, clientes: 30, clientesNombres: [], entradas: ["Fir24", "Hakuna Cafe"], bajas: ["Palace Gym"], bajasVencimientos: null, bajasClientes: ["Palace Gym"], sinPrecio: [] };
      return { ok: true, data: { anio, mes, archivo: archivo.name, ...insumos, roles: leer("roles.json"), clientes: leer("clientes.json"), dolar: { compra: 1540, venta: 1562, valor: 1551, fuente: "Prueba local (dólar fijo)" }, metricas, generadoEn: new Date().toISOString() } };
    }
    if (!process.env.NOTION_TOKEN) return { ok: false, error: "Falta NOTION_TOKEN: la skill necesita la Nómina y Clientes de Notion." };
    const [roles, cs, dolar] = await Promise.all([rolesDesdeNotion(), clientesDesdeNotion(), dolarBlue()]);
    const euro = insumos.bloques[insumos.idx].meta.eur;
    const metricas = await metricasDelMes(cs, anio, mes, euro);
    return {
      ok: true,
      data: { anio, mes, archivo: archivo.name, ...insumos, roles, clientes: clientesParaMotor(cs, anio, mes), dolar, metricas, generadoEn: new Date().toISOString() },
    };
  } catch (e) {
    console.error("[finanzas] prepararBorrador:", e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Confirmar: se recalcula en el servidor, se valida y se guarda como versión nueva. */
export async function confirmarMes(b: Borrador, ajustes: Ajustes, resoluciones: Resoluciones, explicaciones: { concepto: string; monto: number }[]): Promise<Res<{ version: number }>> {
  try {
    await soloDuenio();
    const er = calcularER(b.bloques, b.idx, b.roles, b.clientes, ajustes);
    const problema = validarConfirmacion(er, resoluciones, explicaciones);
    if (problema) return { ok: false, error: problema };

    const meses = await todosLosMeses();
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
    revalidatePath("/", "layout");
    return { ok: true, data: { version: reg.version } };
  } catch (e) {
    console.error("[finanzas] confirmarMes:", e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

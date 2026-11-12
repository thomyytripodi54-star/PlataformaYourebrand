import base from "@/data/finanzas/reservas.json";

/**
 * Reservas de la agencia ("poder de fuego"): una foto por mes, en USD.
 * Historial base: la planilla de finanzas (2026). Lo que se carga desde la plataforma se guarda en Redis y gana.
 */
export const TIPOS = {
  efectivo: { nombre: "Efectivo", grupo: "liquidez" },
  banco: { nombre: "Bancos", grupo: "liquidez" },
  billetera: { nombre: "Billeteras virtuales", grupo: "liquidez" },
  cripto: { nombre: "Cripto", grupo: "invertido" },
  inversiones: { nombre: "Inversiones (broker)", grupo: "invertido" },
  acciones: { nombre: "Acciones", grupo: "invertido" },
  deudas: { nombre: "Deudas (+ a cobrar / − a pagar)", grupo: "deudas" },
  otro: { nombre: "Otro", grupo: "liquidez" },
} as const;
export type TipoCuenta = keyof typeof TIPOS;

export type CuentaReserva = { nombre: string; tipo: TipoCuenta; montoUsd: number };
/** `cuentas` en null: del mes solo se sabe el total (meses viejos de la planilla). */
export type ReservaMes = { anio: number; mes: number; totalUsd: number; cuentas: CuentaReserva[] | null; nota?: string; cargadoEn?: string };

export const clave = (m: { anio: number; mes: number }) => `${m.anio}-${String(m.mes).padStart(2, "0")}`;
export const reservasBase = base.meses as ReservaMes[];

/** Total del mes: la suma de las cuentas (las deudas con su signo) o el total cargado. */
export const totalDe = (m: Pick<ReservaMes, "cuentas" | "totalUsd">) => (m.cuentas ? m.cuentas.reduce((s, c) => s + c.montoUsd, 0) : m.totalUsd);

/** Historial ordenado: el base más lo cargado en la plataforma (gana lo cargado). */
export function combinar(baseMeses: ReservaMes[], cargados: ReservaMes[]): ReservaMes[] {
  const porMes = new Map(baseMeses.map((m) => [clave(m), m]));
  for (const m of cargados) porMes.set(clave(m), m);
  return [...porMes.values()].map((m) => ({ ...m, totalUsd: Math.round(totalDe(m) * 100) / 100 })).sort((a, b) => a.anio - b.anio || a.mes - b.mes);
}

/** Liquidez (efectivo, bancos, billeteras), invertido (cripto, broker, acciones) y deudas de un mes con desglose. */
export function composicion(m: ReservaMes) {
  const r = { liquidez: 0, invertido: 0, deudas: 0 };
  for (const c of m.cuentas ?? []) r[TIPOS[c.tipo].grupo] += c.montoUsd;
  return r;
}

/** Valida y normaliza lo que llega del formulario. Devuelve el mes listo para guardar o el error. */
export function validarCarga(x: unknown): ReservaMes | string {
  const m = x as Partial<ReservaMes>;
  if (!Number.isInteger(m?.anio) || m.anio! < 2024 || m.anio! > 2100 || !Number.isInteger(m?.mes) || m.mes! < 1 || m.mes! > 12) return "Mes inválido.";
  if (!Array.isArray(m.cuentas) || !m.cuentas.length) return "Cargá al menos una cuenta.";
  const cuentas: CuentaReserva[] = [];
  for (const c of m.cuentas) {
    const nombre = String(c?.nombre ?? "").trim().slice(0, 40);
    if (!nombre) return "Cada cuenta necesita un nombre.";
    if (!(c.tipo in TIPOS)) return `Tipo inválido en «${nombre}».`;
    const monto = Number(c.montoUsd);
    if (!Number.isFinite(monto) || Math.abs(monto) > 1e9) return `Monto inválido en «${nombre}».`;
    if (monto < 0 && c.tipo !== "deudas") return `«${nombre}» no puede ser negativo (solo las deudas).`;
    cuentas.push({ nombre, tipo: c.tipo, montoUsd: Math.round(monto * 100) / 100 });
  }
  const nota = typeof m.nota === "string" && m.nota.trim() ? m.nota.trim().slice(0, 300) : undefined;
  return { anio: m.anio!, mes: m.mes!, cuentas, totalUsd: Math.round(cuentas.reduce((s, c) => s + c.montoUsd, 0) * 100) / 100, ...(nota ? { nota } : {}) };
}

import type { Cliente } from "@/lib/clientes";

export type Caso = {
  titulo: string;
  gravedad: "Leve" | "Grave" | "URGENTE";
  cliente: string | null;
  fecha: string;
  notionUrl: string;
  situacion?: string | null;
  responsables?: string[]; // ids de personas
};

/** Orden de importancia: URGENTE > Grave > Leve; a igual importancia, el más reciente primero. */
export const PRIORIDAD: Record<Caso["gravedad"], number> = { URGENTE: 0, Grave: 1, Leve: 2 };
export function ordenarCasos<T extends Caso>(casos: T[]) {
  return [...casos].sort((a, b) => PRIORIDAD[a.gravedad] - PRIORIDAD[b.gravedad] || b.fecha.localeCompare(a.fecha));
}
export type AreaId = "direccion" | "rrhh" | "asistencia" | "jefatura-creativa" | "cms" | "ugc" | "paid";
export type Persona = {
  id: string;
  nombre: string;
  rol: string;
  area: AreaId;
  telefono: string | null;
  email: string | null;
  ingreso: string | null;
  clientes: string[];
  casosAbiertos: Caso[];
};

export const AREAS = {
  cms: { nombre: "Community Managers", descripcion: "Gestión de cuentas y redes" },
  ugc: { nombre: "Área UGC", descripcion: "Creación, grabación y edición" },
  paid: { nombre: "Paid media", descripcion: "Campañas, pauta y web" },
} as const;

/** Asesores externos (no figuran en la Nómina). */
export const EXTERNOS = [{ nombre: "Germán Brameri", rol: "Contador" }];

export type ClienteMin = Pick<Cliente, "id" | "nombre" | "logo">;

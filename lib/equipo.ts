import data from "@/data/equipo.json";
import { clientes, type Cliente } from "@/lib/clientes";

export type Caso = { titulo: string; gravedad: "Leve" | "Grave" | "URGENTE"; cliente: string | null; fecha: string; notionUrl: string };
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

export const equipo = data as Persona[];

export const AREAS = {
  cms: { nombre: "Community Managers", descripcion: "Gestión de cuentas y redes" },
  ugc: { nombre: "Área UGC", descripcion: "Creación, grabación y edición" },
  paid: { nombre: "Paid media", descripcion: "Campañas, pauta y web" },
} as const;

/** Asesores externos (no figuran en la Nómina). */
export const EXTERNOS = [{ nombre: "Germán Brameri", rol: "Contador" }];

const porId = new Map(clientes.map((c) => [c.id, c]));
export function clientesDe(p: Persona): Pick<Cliente, "id" | "nombre" | "logo">[] {
  return p.clientes.map((id) => porId.get(id)).filter(Boolean).map((c) => ({ id: c!.id, nombre: c!.nombre, logo: c!.logo }));
}
export function nombreCliente(id: string | null) {
  return (id && porId.get(id)?.nombre) || "Cliente";
}

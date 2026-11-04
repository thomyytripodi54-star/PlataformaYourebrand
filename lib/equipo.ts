import data from "@/data/equipo.json";
import { clientes, type Cliente } from "@/lib/clientes";

export type Caso = { titulo: string; gravedad: "Leve" | "Grave" | "URGENTE"; cliente: string | null; fecha: string; notionUrl: string };
export type AreaId = "direccion" | "cms" | "publicistas" | "creadores" | "edicion" | "staff";
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

export const AREAS: { id: Exclude<AreaId, "direccion">; nombre: string; descripcion: string }[] = [
  { id: "cms", nombre: "Community Managers", descripcion: "Gestión de cuentas y redes" },
  { id: "publicistas", nombre: "Publicistas", descripcion: "Campañas y pauta" },
  { id: "creadores", nombre: "Creadores de contenido", descripcion: "Grabación y UGC" },
  { id: "edicion", nombre: "Edición", descripcion: "Edición de video" },
  { id: "staff", nombre: "Staff", descripcion: "RRHH, asistencia y desarrollo" },
];

const porId = new Map(clientes.map((c) => [c.id, c]));
export function clientesDe(p: Persona): Pick<Cliente, "id" | "nombre" | "logo">[] {
  return p.clientes.map((id) => porId.get(id)).filter(Boolean).map((c) => ({ id: c!.id, nombre: c!.nombre, logo: c!.logo }));
}
export function nombreCliente(id: string | null) {
  return (id && porId.get(id)?.nombre) || "Cliente";
}

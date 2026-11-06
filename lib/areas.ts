export type Seccion = { href: string; label: string; alerta?: boolean };
export type Area = { nombre: string; detalle: string; prefijo: string | null; secciones: Seccion[] };

/** Áreas de la plataforma: alimentan el menú de inicio y la barra de cada área. */
export const AREAS: Area[] = [
  { nombre: "Dirección", detalle: "Dashboard de clientes", prefijo: "/clientes", secciones: [{ href: "/clientes/dashboard", label: "Dashboard de clientes" }] },
  {
    nombre: "RRHH",
    detalle: "Organigrama, casos y comentarios",
    prefijo: "/rrhh",
    secciones: [
      { href: "/rrhh/organigrama", label: "Organigrama" },
      { href: "/rrhh/casos", label: "Casos abiertos" },
      { href: "/rrhh/comentarios", label: "Comentarios" },
    ],
  },
  { nombre: "Finanzas", detalle: "Estado de Resultados", prefijo: "/finanzas", secciones: [{ href: "/finanzas/estado-de-resultados", label: "Estado de Resultados", alerta: true }] },
  { nombre: "Creativa", detalle: "", prefijo: null, secciones: [] },
  { nombre: "Operaciones", detalle: "", prefijo: null, secciones: [] },
];

/** Área a la que pertenece una ruta. */
export function areaDe(path: string): Area | undefined {
  return AREAS.find((a) => a.prefijo && (path === a.prefijo || path.startsWith(a.prefijo + "/")));
}

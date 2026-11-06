import { getDatos } from "@/lib/datos";
import { pendienteActual } from "@/lib/er/datos";
import { ubicar } from "@/lib/geo";
import { Inicio, type AreaInicio, type PuntoInicio } from "@/components/Inicio";

export const revalidate = 60;

export default async function Home() {
  const [{ clientes }, pendiente] = await Promise.all([getDatos(), pendienteActual()]);
  const puntos: PuntoInicio[] = clientes
    .filter((c) => c.estado === "Activo" && c.pais === "Argentina")
    .map((c) => ubicar(c.ubicacion ?? [], c.pais))
    .filter((u): u is NonNullable<typeof u> => !!u)
    .map(({ lat, lng }) => ({ lat, lng }));
  const areas: AreaInicio[] = [
    { nombre: "Dirección", detalle: "Dashboard de clientes", href: "/clientes/dashboard" },
    { nombre: "RRHH", detalle: "Organigrama, casos y comentarios", href: "/rrhh/organigrama" },
    { nombre: "Finanzas", detalle: "Estado de Resultados", href: "/finanzas/estado-de-resultados", alerta: !!pendiente },
    { nombre: "Creativa", detalle: "", href: null },
    { nombre: "Operaciones", detalle: "", href: null },
  ];
  return <Inicio puntos={puntos} areas={areas} />;
}

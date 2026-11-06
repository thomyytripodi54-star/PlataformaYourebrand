import { getDatos } from "@/lib/datos";
import { pendienteActual } from "@/lib/er/datos";
import { ubicar } from "@/lib/geo";
import { Inicio, type AreaInicio, type PuntoInicio } from "@/components/Inicio";
import { AREAS } from "@/lib/areas";

export const revalidate = 60;

export default async function Home() {
  const [{ clientes }, pendiente] = await Promise.all([getDatos(), pendienteActual()]);
  const puntos: PuntoInicio[] = clientes
    .filter((c) => c.estado === "Activo" && c.pais === "Argentina")
    .map((c) => ubicar(c.ubicacion ?? [], c.pais))
    .filter((u): u is NonNullable<typeof u> => !!u)
    .map(({ lat, lng }) => ({ lat, lng }));
  const areas: AreaInicio[] = AREAS.map((a) => ({
    nombre: a.nombre,
    detalle: a.detalle,
    href: a.secciones[0]?.href ?? null,
    alerta: a.nombre === "Finanzas" && !!pendiente,
  }));

  return <Inicio puntos={puntos} areas={areas} />;
}

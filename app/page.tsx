import { getComentarios, getDatos } from "@/lib/datos";
import { pendientesFollowUp } from "@/lib/followup";
import { pendienteActual } from "@/lib/er/datos";
import { ubicar } from "@/lib/geo";
import { Inicio, type AreaInicio, type ComentarioAviso, type Notificaciones, type PuntoInicio } from "@/components/Inicio";
import { AREAS } from "@/lib/areas";

// Lee el follow up en vivo (Redis): se arma en cada visita; los datos de Notion siguen en caché.
export const dynamic = "force-dynamic";

const haceUnaSemana = () => Date.now() - 7 * 86_400_000;

/** Últimos comentarios para el aviso del inicio (los no leídos se filtran en el navegador). */
async function ultimosComentarios(nombre: Map<string, string>): Promise<ComentarioAviso[]> {
  const { comentarios } = await getComentarios();
  return [...comentarios]
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, 60)
    .map((c) => ({ id: c.id, cliente: nombre.get(c.cliente) ?? c.cliente, autor: c.autor, texto: c.texto.slice(0, 120), fecha: c.fecha }));
}

export default async function Home() {
  const [{ clientes, casos }, pendiente, fu] = await Promise.all([getDatos(), pendienteActual(), pendientesFollowUp()]);
  const nombre = new Map(clientes.map((c) => [c.id, c.nombre]));
  // Los comentarios (los de todos los clientes) no traban el inicio: llegan en paralelo y se muestran al estar listos.
  const comentarios = ultimosComentarios(nombre);
  const semana = haceUnaSemana();
  const notificaciones: Notificaciones = {
    followUp: fu.filter((f) => nombre.has(f.id)).map((f) => ({ id: f.id, nombre: nombre.get(f.id)!, dias: f.estado.dias })),
    casos: casos
      .filter((k) => new Date(k.fecha).getTime() >= semana)
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .map((k) => ({ titulo: k.titulo, cliente: k.cliente ? (nombre.get(k.cliente) ?? null) : null, gravedad: k.gravedad, fecha: k.fecha })),
  };
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

  return <Inicio puntos={puntos} areas={areas} notificaciones={notificaciones} comentarios={comentarios} />;
}

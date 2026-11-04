import { getComentarios, getDatos } from "@/lib/datos";
import { Comentarios } from "./Comentarios";

export const revalidate = 60;
export const metadata = { title: "Comentarios · Yourebrand" };

export default async function ComentariosPage() {
  const [{ comentarios, motivo }, { clientes, equipo }] = await Promise.all([getComentarios(), getDatos()]);
  return (
    <Comentarios
      comentarios={comentarios}
      motivo={motivo}
      clientes={clientes.map((c) => ({ id: c.id, nombre: c.nombre, logo: c.logo }))}
      equipo={equipo.map((p) => ({ nombre: p.nombre, rol: p.rol }))}
    />
  );
}

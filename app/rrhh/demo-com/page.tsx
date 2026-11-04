import { getDatos } from "@/lib/datos";
import { Comentarios } from "../comentarios/Comentarios";
export default async function P() {
  const { clientes, equipo } = await getDatos();
  const k = (id: string, cliente: string, autor: string, texto: string, fecha: string) => ({ id, cliente, autor, autorId: autor, texto, fecha, notionUrl: "https://app.notion.com/x" });
  return <Comentarios clientes={clientes.map((c) => ({ id: c.id, nombre: c.nombre, logo: c.logo }))} equipo={equipo.map((p) => ({ nombre: p.nombre, rol: p.rol }))}
    comentarios={[k("1","palace-gym","Victoria Calisaya","Pidió cambiar el copy del reel del jueves.","2026-11-04T13:05:00Z"), k("2","fedora-coffee","Lara Molina Speranza","Aprobaron la grilla de noviembre.","2026-11-03T18:40:00Z"), k("3","palace-gym","Thomas Tripodi","Ojo con los tiempos de entrega, ya hubo dos reclamos.\nHablemos el lunes.","2026-11-02T10:12:00Z")]} />;
}

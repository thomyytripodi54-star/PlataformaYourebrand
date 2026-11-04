import { getDatos } from "@/lib/datos";
import { CasosAbiertos } from "./CasosAbiertos";

export const revalidate = 60;
export const metadata = { title: "Casos abiertos · Yourebrand" };

export default async function CasosPage() {
  const { casos, clientes, equipo } = await getDatos();
  return (
    <CasosAbiertos
      casos={casos}
      clientes={clientes.map((c) => ({ id: c.id, nombre: c.nombre, logo: c.logo }))}
      equipo={equipo.map((p) => ({ id: p.id, nombre: p.nombre, rol: p.rol }))}
    />
  );
}

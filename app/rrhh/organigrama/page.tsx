import { getDatos } from "@/lib/datos";
import { Organigrama } from "./Organigrama";

export const revalidate = 60;
export const metadata = { title: "Organigrama · Yourebrand" };

export default async function OrganigramaPage() {
  const { equipo, clientes } = await getDatos();
  return <Organigrama equipo={equipo} clientes={clientes.map((c) => ({ id: c.id, nombre: c.nombre, logo: c.logo }))} />;
}

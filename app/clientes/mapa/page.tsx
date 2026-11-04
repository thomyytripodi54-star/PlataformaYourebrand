import { getDatos } from "@/lib/datos";
import { MapaClientes } from "./MapaClientes";

export const revalidate = 60;
export const metadata = { title: "Mapa de clientes · Yourebrand" };

export default async function MapaPage() {
  const { clientes } = await getDatos();
  return <MapaClientes clientes={clientes.filter((c) => c.estado === "Activo")} />;
}

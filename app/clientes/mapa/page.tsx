import { clientes } from "@/lib/clientes";
import { MapaClientes } from "./MapaClientes";

export const metadata = { title: "Mapa de clientes · Yourebrand" };

export default function MapaPage() {
  const activos = clientes.filter((c) => c.estado === "Activo");
  return <MapaClientes clientes={activos} />;
}

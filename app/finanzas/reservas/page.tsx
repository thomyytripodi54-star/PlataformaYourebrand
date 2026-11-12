import { todasLasReservas } from "@/lib/reservas-almacen";
import { Reservas } from "./Reservas";

export const metadata = { title: "Reservas · Yourebrand" };
export const dynamic = "force-dynamic";

export default async function Page() {
  return <Reservas meses={await todasLasReservas()} />;
}

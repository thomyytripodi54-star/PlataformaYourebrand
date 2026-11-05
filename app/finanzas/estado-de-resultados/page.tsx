import { meses, mesPendiente } from "@/lib/finanzas";
import { EstadoResultados } from "./EstadoResultados";

export const metadata = { title: "Estado de Resultados · Yourebrand" };
// Se recalcula en cada visita para que la alerta del mes pendiente esté al día.
export const dynamic = "force-dynamic";

export default function Page() {
  return <EstadoResultados meses={meses} pendiente={mesPendiente()} />;
}

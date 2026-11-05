import { pendienteActual, todosLosMeses } from "@/lib/er/datos";
import { EstadoResultados } from "./EstadoResultados";

export const metadata = { title: "Estado de Resultados · Yourebrand" };
// Se recalcula en cada visita para que la alerta del mes pendiente esté al día.
export const dynamic = "force-dynamic";

export default async function Page() {
  const [meses, pendiente] = await Promise.all([todosLosMeses(), pendienteActual()]);
  return <EstadoResultados meses={meses} pendiente={pendiente} />;
}

import { pendienteActual, todosLosMeses } from "@/lib/er/datos";
import { totales } from "@/lib/finanzas";
import { composicion } from "@/lib/reservas";
import { todasLasReservas } from "@/lib/reservas-almacen";
import { ResumenFinanzas } from "./ResumenFinanzas";

export const metadata = { title: "Finanzas · Yourebrand" };
export const dynamic = "force-dynamic";

/** Pestaña principal de Finanzas: reservas y último estado de resultados, con acceso a cada sección. */
export default async function Finanzas() {
  const [reservas, meses, pendiente] = await Promise.all([todasLasReservas(), todosLosMeses(), pendienteActual()]);
  const ultimaER = [...meses].reverse().find((m) => m.estado === "consolidado") ?? null;
  const anteriorER = ultimaER ? meses[meses.indexOf(ultimaER) - 1] ?? null : null;
  const conDesglose = [...reservas].reverse().find((m) => m.cuentas) ?? null;
  const t = ultimaER ? totales(ultimaER) : null;
  const tAnt = anteriorER ? totales(anteriorER) : null;
  return (
    <ResumenFinanzas
      reservas={{
        serie: reservas.map((m) => ({ anio: m.anio, mes: m.mes, total: m.totalUsd })),
        composicion: conDesglose ? { anio: conDesglose.anio, mes: conDesglose.mes, ...composicion(conDesglose) } : null,
      }}
      er={
        ultimaER && t
          ? {
              anio: ultimaER.anio,
              mes: ultimaER.mes,
              ingresosUsd: t.ingresosUsd,
              utilidadUsd: t.utilidadUsd,
              utilidadPct: t.utilidadPct,
              margenPct: t.margenPct,
              utilidadUsdAnterior: tAnt?.utilidadUsd ?? null,
              clientes: ultimaER.clientes,
            }
          : null
      }
      pendiente={pendiente ? { anio: pendiente.anio, mes: pendiente.mes, atrasado: pendiente.atrasado } : null}
    />
  );
}

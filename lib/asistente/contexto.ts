import "server-only";
import { getComentarios, getDatos } from "@/lib/datos";
import { todosLosMeses } from "@/lib/er/datos";
import { MESES, totales, type MesER } from "@/lib/finanzas";
import { estado as estadoFollowUp, followUps } from "@/lib/followup";
import { AREAS } from "@/lib/equipo";
import { leerPlanilla } from "./planilla";
import { reunionesDeVenta, type ReunionVenta } from "./ventas";

/*
 * Arma lo que sabe el asistente. Es texto determinista (mismo orden siempre) para que el
 * prompt caching de la API lo reutilice entre preguntas: lo que cambia seguido (fecha de hoy,
 * follow ups) va aparte, en `contextoDelDia`.
 * No incluye teléfonos ni emails de clientes, leads o equipo.
 */

const ars = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;
const usd = (n: number) => `USD ${Math.round(n).toLocaleString("es-AR")}`;
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const fila = (celdas: (string | number | null | undefined)[]) => `| ${celdas.map((c) => (c ?? "").toString().replace(/\|/g, "/")).join(" | ")} |`;
const tabla = (cabecera: string[], filas: (string | number | null | undefined)[][]) =>
  [fila(cabecera), fila(cabecera.map(() => "---")), ...filas.map(fila)].join("\n");

function estadoDeResultados(meses: MesER[]) {
  const filas = meses.map((m) => {
    const t = totales(m);
    return [
      `${MESES[m.mes - 1]} ${m.anio}`,
      m.estado,
      m.dolar,
      ars(t.ingresosBrutos),
      usd(t.ingresosUsd),
      ars(t.costosOperativos),
      pct(t.margenPct),
      ars(t.costosFijos),
      ars(m.extras),
      ars(m.impuestos + m.fees),
      ars(t.utilidadNeta),
      usd(t.utilidadUsd),
      pct(t.utilidadPct),
      m.clientes,
      m.entradas,
      m.bajas,
    ];
  });
  const detalle = meses
    .map((m) => {
      const t = totales(m);
      const linea = (o: Record<string, number | null>) =>
        Object.entries(o)
          .filter(([, v]) => v !== null)
          .map(([k, v]) => `${k} ${ars(v as number)}`)
          .join(", ");
      const textos = [
        m.analisis.length && `Análisis: ${m.analisis.join(" / ")}`,
        m.objetivos.length && `Objetivos: ${m.objetivos.join(" / ")}`,
        m.mejoras.length && `Mejoras: ${m.mejoras.join(" / ")}`,
      ].filter(Boolean);
      return [
        `### ${MESES[m.mes - 1]} ${m.anio} (dólar ${m.dolar})`,
        `Ingresos: ${linea(m.ingresos)}. Costos operativos: ${linea(m.costosOperativos)}. Costos fijos: ${linea(m.costosFijos)}.`,
        `Recurrencias: ARS ${ars(m.recurrencias.ars)} + EUR en ARS ${ars(m.recurrencias.eurEnArs)} (total ${ars(t.recurrenciaTotal)}).`,
        ...textos,
      ].join("\n");
    })
    .join("\n\n");
  return `## Estado de resultados (plataforma, en ARS; USD al dólar de cada mes)
${tabla(["Mes", "Estado", "Dólar", "Ingresos brutos", "Ingresos USD", "Costos operativos", "Margen operativo %", "Costos fijos", "Extras", "Impuestos+fees", "Utilidad neta", "Utilidad USD", "Utilidad %", "Clientes", "Altas", "Bajas"], filas)}

${detalle}`;
}

function planillaComoTexto(tablas: Record<string, string[][]>) {
  return Object.entries(tablas)
    .map(([nombre, filas]) => {
      const limpias = filas.map((f) => f.map((c) => (c ?? "").trim())).filter((f) => f.some(Boolean));
      return `### ${nombre}\n${limpias.map((f) => `| ${f.join(" | ")} |`).join("\n")}`;
    })
    .join("\n\n");
}

function funnelDeVenta(reuniones: ReunionVenta[], motivo?: string) {
  if (motivo) return `## Funnel de venta (Notion › Reuniones de venta)\nNo disponible: ${motivo}`;
  // Resumen por mes de reunión y por campaña de origen (lo que más se pregunta), más el detalle.
  const porMes = new Map<string, { reuniones: number; atendidas: number; contratos: number; eur: number; ars: number }>();
  const porCampana = new Map<string, { reuniones: number; contratos: number; eur: number; ars: number }>();
  for (const r of reuniones) {
    const mes = r.fechaReunion?.slice(0, 7) ?? "sin fecha";
    const m = porMes.get(mes) ?? { reuniones: 0, atendidas: 0, contratos: 0, eur: 0, ars: 0 };
    const c = porCampana.get(r.campana ?? "sin campaña") ?? { reuniones: 0, contratos: 0, eur: 0, ars: 0 };
    const contrato = r.estado === "Contrato";
    m.reuniones++;
    if (r.estado !== "No Atendio") m.atendidas++;
    c.reuniones++;
    if (contrato) {
      m.contratos++;
      c.contratos++;
      m.eur += r.pagoEur ?? 0;
      m.ars += r.pagoArs ?? 0;
      c.eur += r.pagoEur ?? 0;
      c.ars += r.pagoArs ?? 0;
    }
    porMes.set(mes, m);
    porCampana.set(r.campana ?? "sin campaña", c);
  }
  const conv = (a: number, b: number) => (b ? pct(a / b) : "-");
  return `## Funnel de venta (Notion › Reuniones de venta) — ${reuniones.length} reuniones
Estados: "No Atendio" (no se presentó), "Evaluando", "Contrato" (contrató). Pago = abono pactado (EUR o ARS).

### Por mes de reunión
${tabla(
  ["Mes", "Reuniones", "Atendidas", "Contratos", "Conv. reunión→contrato", "Pagos EUR", "Pagos ARS"],
  [...porMes.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, v.reuniones, v.atendidas, v.contratos, conv(v.contratos, v.reuniones), v.eur || "", v.ars ? ars(v.ars) : ""]),
)}

### Por campaña de origen
${tabla(
  ["Campaña", "Reuniones", "Contratos", "Conv.", "Pagos EUR", "Pagos ARS"],
  [...porCampana.entries()].sort(([, a], [, b]) => b.reuniones - a.reuniones).map(([k, v]) => [k, v.reuniones, v.contratos, conv(v.contratos, v.reuniones), v.eur || "", v.ars ? ars(v.ars) : ""]),
)}

### Detalle
${tabla(
  ["Nombre", "Fecha reunión", "Estado", "Fecha contratación", "Campaña", "Calificación", "Pago EUR", "Pago ARS"],
  reuniones.map((r) => [r.nombre, r.fechaReunion, r.estado, r.fechaContratacion, r.campana, r.calificacion.join(", "), r.pagoEur, r.pagoArs ? ars(r.pagoArs) : ""]),
)}`;
}

/** Contexto estable (se cachea en la API). */
export async function contextoAgencia(): Promise<string> {
  const conTope = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<null>((ok) => setTimeout(() => ok(null), ms))]);
  const [datos, meses, planilla, ventas, comentarios] = await Promise.all([
    getDatos(),
    todosLosMeses(),
    leerPlanilla(),
    reunionesDeVenta(),
    // Los comentarios de los 34 clientes pueden tardar si la caché está vacía: no frenan al asistente.
    conTope(getComentarios(), 4000),
  ]);
  const { clientes, equipo, casos } = datos;
  const nombreCliente = new Map(clientes.map((c) => [c.id, c.nombre]));
  const nombrePersona = new Map(equipo.map((p) => [p.id, p.nombre]));
  const casosPorCliente = new Map<string, number>();
  for (const k of casos) if (k.cliente) casosPorCliente.set(k.cliente, (casosPorCliente.get(k.cliente) ?? 0) + 1);

  const activos = clientes.filter((c) => c.estado === "Activo").sort((a, b) => a.nombre.localeCompare(b.nombre));
  const seccionClientes = `## Clientes activos (${activos.length}) — Notion
${tabla(
  ["Cliente", "País / zona", "Segmento", "Rubros", "Planes", "Desde", "Vencimiento", "Abono mensual", "Margen contribución (ARS)", "Satisfacción", "Casos abiertos"],
  activos.map((c) => [
    c.nombre,
    [c.pais, c.ubicacion.join(", ")].filter(Boolean).join(" · "),
    c.segmento,
    c.rubros.join(", "),
    c.planes.join(", "),
    c.desde,
    c.vencimiento,
    c.pagoMensual ? `${c.pagoMensual.moneda} ${c.pagoMensual.monto.toLocaleString("es-AR")}` : "",
    c.margen !== null ? ars(c.margen) : "",
    c.satisfaccion,
    casosPorCliente.get(c.id) ?? 0,
  ]),
)}`;

  const seccionEquipo = `## Organigrama y equipo (${equipo.length} personas) — Notion › Nómina
${tabla(
  ["Persona", "Rol", "Área", "Ingreso", "Clientes a cargo", "Casos abiertos"],
  [...equipo]
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map((p) => [p.nombre, p.rol, (AREAS as Record<string, { nombre: string } | undefined>)[p.area]?.nombre ?? p.area, p.ingreso, p.clientes.map((id) => nombreCliente.get(id) ?? id).join(", "), p.casosAbiertos.length]),
)}`;

  const seccionCasos = `## Casos abiertos (${casos.length}) — RRHH
${tabla(
  ["Caso", "Gravedad", "Cliente", "Cargado", "Responsables", "Situación"],
  casos.map((k) => [k.titulo, k.gravedad, k.cliente ? nombreCliente.get(k.cliente) : "", k.fecha, (k.responsables ?? []).map((r) => nombrePersona.get(r) ?? r).join(", "), k.situacion?.replace(/\s+/g, " ").slice(0, 300)]),
)}`;

  const ultimos = comentarios ? [...comentarios.comentarios].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 40) : null;
  const seccionComentarios = !ultimos
    ? "## Comentarios recientes de clientes\nNo se cargaron a tiempo en esta consulta."
    : `## Comentarios recientes sobre clientes (últimos ${ultimos.length}, Notion)
${ultimos.map((k) => `- ${k.fecha.slice(0, 10)} · ${nombreCliente.get(k.cliente) ?? k.cliente} · ${k.autor}: ${k.texto.replace(/\s+/g, " ").slice(0, 280)}`).join("\n")}`;

  return [
    `# Datos de Yourebrand (origen de Notion: ${datos.origen === "notion" ? "en vivo" : "copia local"})`,
    estadoDeResultados(meses),
    `## Planilla "Yourebrand Finanzas" (${planilla.origen === "en vivo" ? "leída en vivo" : `copia del ${planilla.actualizado}`}): publicidad, métricas y objetivos\n${planillaComoTexto(planilla.tablas)}`,
    `## Pestañas de cada mes y de cada trimestre (planilla): estado de resultados, objetivos, análisis y progreso
${
  planilla.origen === "copia"
    ? "Copia parcial: octubre 2026 y los 4 trimestres de 2026. Enero a septiembre 2026 están arriba, en el estado de resultados de la plataforma (con análisis, objetivos cumplidos y puntos de mejora de cada mes). Los meses de 2025 solo se ven con la planilla en vivo.\n\n"
    : ""
}${Object.entries(planilla.pestanas)
      .map(([t, txt]) => `### ${t}\n${txt}`)
      .join("\n\n")}`,
    funnelDeVenta(ventas.reuniones, ventas.motivo),
    seccionClientes,
    seccionEquipo,
    seccionCasos,
    seccionComentarios,
  ].join("\n\n");
}

/** Lo que cambia seguido: va después del contexto cacheado. */
export async function contextoDelDia(): Promise<string> {
  const [fus, { clientes }] = await Promise.all([followUps(), getDatos()]);
  const nombre = new Map(clientes.map((c) => [c.id, c.nombre]));
  const hoy = new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" });
  const lista = Object.entries(fus)
    .map(([id, f]) => ({ id, e: estadoFollowUp(f) }))
    .sort((a, b) => a.e.dias - b.e.dias)
    .map(({ id, e }) => `- ${nombre.get(id) ?? id}: cada ${e.cada} días, último ${e.ultimo.slice(0, 10)}, ${e.vencido ? `ATRASADO ${-e.dias} días` : `faltan ${e.dias} días`}`);
  return `Hoy es ${hoy}.\n\n## Follow ups de clientes\n${lista.length ? lista.join("\n") : "Ningún cliente tiene follow up configurado."}`;
}

import { getDatos } from "@/lib/datos";
import { estado, followUps } from "@/lib/followup";
import { Dashboard, type Vista } from "./Dashboard";

// Lee el follow up en vivo (Redis): se arma en cada visita; los datos de Notion siguen en caché.
export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard de clientes · Yourebrand" };

const VISTAS: Vista[] = ["estadisticas", "satisfaccion", "geografia"];

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const { vista } = await searchParams;
  const [{ clientes, casos, equipo }, fus] = await Promise.all([getDatos(), followUps()]);
  // Filtro del mapa por integrante: solo Community Managers y Publicistas con cuentas asignadas.
  const activos = new Set(clientes.filter((c) => c.estado === "Activo").map((c) => c.id));
  const responsables = equipo
    .map((p) => ({
      id: p.id,
      nombre: p.nombre,
      grupo: /publicista/i.test(p.rol) ? ("Publicistas" as const) : /community manager/i.test(p.rol) ? ("Community Managers" as const) : null,
      clientes: p.clientes.filter((id) => activos.has(id)),
    }))
    .filter((p): p is typeof p & { grupo: "Publicistas" | "Community Managers" } => !!p.grupo && p.clientes.length > 0)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  const estados = Object.fromEntries(Object.entries(fus).map(([id, f]) => [id, estado(f)]));
  return (
    <Dashboard
      clientes={clientes.filter((c) => c.estado === "Activo")}
      casos={casos}
      followUp={Object.keys(estados).filter((id) => estados[id].vencido)}
      estadosFollowUp={estados}
      responsables={responsables}
      vistaInicial={VISTAS.includes(vista as Vista) ? (vista as Vista) : "geografia"}
    />
  );
}

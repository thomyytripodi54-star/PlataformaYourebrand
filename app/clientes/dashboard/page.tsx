import { getDatos } from "@/lib/datos";
import { estado, followUps } from "@/lib/followup";
import { Dashboard, type Vista } from "./Dashboard";

// Lee el follow up en vivo (Redis): se arma en cada visita; los datos de Notion siguen en caché.
export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard de clientes · Yourebrand" };

const VISTAS: Vista[] = ["estadisticas", "satisfaccion", "geografia"];

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const { vista } = await searchParams;
  const [{ clientes, casos }, fus] = await Promise.all([getDatos(), followUps()]);
  const estados = Object.fromEntries(Object.entries(fus).map(([id, f]) => [id, estado(f)]));
  return (
    <Dashboard
      clientes={clientes.filter((c) => c.estado === "Activo")}
      casos={casos}
      followUp={Object.keys(estados).filter((id) => estados[id].vencido)}
      estadosFollowUp={estados}
      vistaInicial={VISTAS.includes(vista as Vista) ? (vista as Vista) : "geografia"}
    />
  );
}

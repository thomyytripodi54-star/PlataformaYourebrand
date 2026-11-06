import { getDatos } from "@/lib/datos";
import { pendientesFollowUp } from "@/lib/followup";
import { Dashboard, type Vista } from "./Dashboard";

export const revalidate = 60;
export const metadata = { title: "Dashboard de clientes · Yourebrand" };

const VISTAS: Vista[] = ["estadisticas", "satisfaccion", "geografia"];

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const { vista } = await searchParams;
  const [{ clientes, casos }, fu] = await Promise.all([getDatos(), pendientesFollowUp()]);
  return (
    <Dashboard
      clientes={clientes.filter((c) => c.estado === "Activo")}
      casos={casos}
      followUp={fu.map((x) => x.id)}
      vistaInicial={VISTAS.includes(vista as Vista) ? (vista as Vista) : "geografia"}
    />
  );
}

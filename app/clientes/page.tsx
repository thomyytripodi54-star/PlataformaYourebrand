import { clientes } from "@/lib/clientes";
import { ListaClientes } from "./ListaClientes";

export default function ClientesPage() {
  const activos = clientes.filter((c) => c.estado === "Activo");
  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Dirección</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Clientes</h1>
        <p className="mt-1 text-sm text-zinc-500">{activos.length} clientes activos</p>
      </header>
      <ListaClientes clientes={clientes} />
    </div>
  );
}

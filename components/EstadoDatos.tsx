import { getDatos } from "@/lib/datos";

export async function EstadoDatos() {
  const d = await getDatos();
  const hora = new Date(d.actualizado).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" });
  return d.origen === "notion" ? (
    <p className="hidden items-center gap-1.5 text-[11px] text-white/45 sm:flex">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Notion en vivo · {hora}
    </p>
  ) : (
    <p className="hidden items-center gap-1.5 rounded-full bg-accent/20 px-2.5 py-1 text-[11px] text-white/80 sm:flex" title={d.motivo}>
      <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Copia local (sin Notion)
    </p>
  );
}

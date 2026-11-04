import { getDatos } from "@/lib/datos";

export async function EstadoDatos() {
  const d = await getDatos();
  const hora = new Date(d.actualizado).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" });
  return d.origen === "notion" ? (
    <p className="mt-6 flex items-center gap-1.5 text-[11px] text-zinc-400">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Notion en vivo · {hora}
    </p>
  ) : (
    <div className="mt-6 rounded-lg bg-accent-soft/60 p-2 text-[11px] leading-snug text-ink">
      <p className="font-bold">Copia local (sin Notion)</p>
      <p className="mt-0.5">{d.motivo}</p>
    </div>
  );
}

import type { Cliente } from "@/lib/clientes";

const colores = ["bg-ink text-white", "bg-surface text-ink", "bg-[#d4d4d4] text-ink"];

/** Logo del cliente (o sus iniciales). Con `casos` > 0 muestra el punto rojo de caso abierto, como en el organigrama. */
export function Logo({ cliente, size = 40, casos = 0 }: { cliente: Pick<Cliente, "nombre" | "logo">; size?: number; casos?: number }) {
  const style = { width: size, height: size };
  const iniciales = cliente.nombre.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
  const color = colores[[...cliente.nombre].reduce((a, ch) => a + ch.charCodeAt(0), 0) % colores.length];
  const base = cliente.logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={cliente.logo} alt={cliente.nombre} style={style} className="shrink-0 rounded-full border border-zinc-200 object-cover" />
  ) : (
    <div style={{ ...style, fontSize: size * 0.36 }} className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${color}`}>
      {iniciales}
    </div>
  );
  if (!casos) return base;
  const punto = Math.max(14, Math.round(size * 0.42));
  return (
    <span className="relative inline-flex shrink-0" title={`${casos} ${casos === 1 ? "caso abierto" : "casos abiertos"}`}>
      {base}
      <span
        style={{ width: punto, height: punto, fontSize: punto * 0.62 }}
        className="absolute -right-1 -top-1 flex items-center justify-center rounded-full bg-accent font-bold leading-none text-white ring-2 ring-white"
      >
        {casos}
      </span>
    </span>
  );
}

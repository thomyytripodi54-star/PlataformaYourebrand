import type { Cliente } from "@/lib/clientes";

const colores = ["bg-ink text-white", "bg-surface text-ink", "bg-[#d4d4d4] text-ink"];

export function Logo({ cliente, size = 40 }: { cliente: Pick<Cliente, "nombre" | "logo">; size?: number }) {
  const style = { width: size, height: size };
  if (cliente.logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={cliente.logo} alt={cliente.nombre} style={style} className="shrink-0 rounded-full border border-zinc-200 object-cover" />;
  }
  const iniciales = cliente.nombre.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
  const color = colores[[...cliente.nombre].reduce((a, ch) => a + ch.charCodeAt(0), 0) % colores.length];
  return (
    <div style={{ ...style, fontSize: size * 0.36 }} className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${color}`}>
      {iniciales}
    </div>
  );
}

import type { Cliente } from "@/lib/clientes";

const colores = ["bg-rose-100 text-rose-700", "bg-amber-100 text-amber-700", "bg-emerald-100 text-emerald-700", "bg-sky-100 text-sky-700", "bg-violet-100 text-violet-700", "bg-zinc-200 text-zinc-700"];

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

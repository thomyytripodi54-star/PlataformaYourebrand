export type Cliente = {
  id: string;
  nombre: string;
  estado: "Activo" | "Inactivo";
  instagram: string | null;
  web: string | null;
  linkedin: string | null;
  pais: string | null;
  segmento: string | null;
  planes: string[];
  rubros: string[];
  desde: string | null;
  vencimiento: string | null;
  email: string | null;
  telefono: string | null;
  contacto: string | null;
  pagoMensual: { monto: number; moneda: "ARS" | "EUR" } | null;
  logo: string | null;
  notionUrl: string;
  satisfaccion: "Contento" | "Expectante" | "Insatisfecho" | null;
  /** Margen de contribución mensual, en ARS (campo "Margen contribucion" de Notion). */
  margen: number | null;
  /** Barrio o ciudad (campo "Ubicacion geografic" de Notion). */
  ubicacion: string[];
};

export function formatFecha(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function formatPago(p: Cliente["pagoMensual"]) {
  if (!p) return "—";
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: p.moneda, maximumFractionDigits: 0 }).format(p.monto);
}

/** Días hasta el vencimiento (negativo = vencido). */
export function diasAlVencimiento(iso: string | null, hoy = new Date()) {
  if (!iso) return null;
  const v = new Date(iso + "T00:00:00");
  const h = new Date(hoy.toISOString().slice(0, 10) + "T00:00:00");
  return Math.round((v.getTime() - h.getTime()) / 86400000);
}

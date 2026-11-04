// Coordenadas de referencia por país (la base de Notion no tiene ciudad).
export const PAISES: Record<string, { lat: number; lng: number; bandera: string; ciudad: string }> = {
  Argentina: { lat: -34.6, lng: -58.4, bandera: "🇦🇷", ciudad: "Buenos Aires" },
  España: { lat: 40.4, lng: -3.7, bandera: "🇪🇸", ciudad: "Madrid" },
  USA: { lat: 38.9, lng: -77.0, bandera: "🇺🇸", ciudad: "Washington D.C." },
  Mexico: { lat: 19.4, lng: -99.1, bandera: "🇲🇽", ciudad: "CDMX" },
  Marruecos: { lat: 33.6, lng: -7.6, bandera: "🇲🇦", ciudad: "Casablanca" },
};

export const SEDE = PAISES.Argentina;

/** Ángulos de cobe (phi, theta) para centrar una coordenada. */
export function angulos(lat: number, lng: number): [number, number] {
  return [Math.PI - ((lng * Math.PI) / 180 - Math.PI / 2), (lat * Math.PI) / 180];
}

/* ---------- Ubicaciones (campo "Ubicacion geografic" de Notion) ---------- */
// Coordenadas aproximadas del centro de cada barrio / ciudad. Para sumar una ubicación nueva, agregala acá.
export const LUGARES: Record<string, { lat: number; lng: number }> = {
  caba: { lat: -34.6037, lng: -58.3816 },
  palermo: { lat: -34.5781, lng: -58.4265 },
  recoleta: { lat: -34.5875, lng: -58.3974 },
  belgrano: { lat: -34.5627, lng: -58.4567 },
  caballito: { lat: -34.6186, lng: -58.4419 },
  "villa urquiza": { lat: -34.5733, lng: -58.4877 },
  "vicente lopez": { lat: -34.5263, lng: -58.4729 },
  "san isidro": { lat: -34.4708, lng: -58.5286 },
  tigre: { lat: -34.426, lng: -58.5796 },
  escobar: { lat: -34.3497, lng: -58.7932 },
  "grand bourg": { lat: -34.4878, lng: -58.727 },
  moreno: { lat: -34.6508, lng: -58.7896 },
  "ramos mejia": { lat: -34.6409, lng: -58.5655 },
  haedo: { lat: -34.6438, lng: -58.5939 },
  lanus: { lat: -34.7006, lng: -58.392 },
  "lomas de zamora": { lat: -34.7609, lng: -58.4063 },
  canning: { lat: -34.8592, lng: -58.507 },
  bernal: { lat: -34.7086, lng: -58.2803 },
  quilmes: { lat: -34.7206, lng: -58.2546 },
  "santa fe": { lat: -31.6333, lng: -60.7 },
  salta: { lat: -24.7821, lng: -65.4232 },
  madrid: { lat: 40.4168, lng: -3.7038 },
  washington: { lat: 38.9072, lng: -77.0369 },
};

const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Coordenadas de un cliente: su barrio/ciudad si lo conocemos; si no, el centro de su país. */
export function ubicar(ubicacion: string[], pais: string | null): { lat: number; lng: number; lugar: string; precisa: boolean } | null {
  for (const u of ubicacion) {
    const l = LUGARES[norm(u)];
    if (l) return { ...l, lugar: u, precisa: true };
  }
  const p = pais ? PAISES[pais] : null;
  return p ? { lat: p.lat, lng: p.lng, lugar: pais!, precisa: false } : null;
}

/** CABA + Gran Buenos Aires (rectángulo aproximado del AMBA). */
export const esAMBA = (lat: number, lng: number) => lat > -35.25 && lat < -34.15 && lng > -59.25 && lng < -57.85;

// Encuadres del mapa por país: [oeste, sur, este, norte]
export const ENCUADRES: Record<string, [number, number, number, number]> = {
  AMBA: [-58.95, -34.95, -58.15, -34.28],
  Argentina: [-73.6, -55.1, -53.6, -21.8],
  España: [-9.4, 36.0, 3.4, 43.8],
  USA: [-124.8, 24.5, -66.9, 49.4],
  Mexico: [-117.1, 14.5, -86.7, 32.7],
  Marruecos: [-13.2, 27.7, -1.0, 35.9],
};

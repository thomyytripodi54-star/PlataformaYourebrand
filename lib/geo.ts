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

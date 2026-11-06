import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // El Excel de Yourebrand (BALANCE con 6 años) supera el límite de 1 MB por defecto de las server actions.
    serverActions: { bodySizeLimit: "25mb" },
  },
  // Capas del mapa (~370 KB) y worker de MapLibre: casi nunca cambian. El navegador los guarda un día
  // y después los revalida en segundo plano, en vez de volver a pedirlos en cada visita.
  async headers() {
    const cache = [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }];
    return [
      { source: "/geo/:archivo*", headers: cache },
      { source: "/maplibre/:archivo*", headers: cache },
    ];
  },
};

export default nextConfig;

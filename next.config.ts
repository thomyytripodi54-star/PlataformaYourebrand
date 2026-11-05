import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // El Excel de Yourebrand (BALANCE con 6 años) supera el límite de 1 MB por defecto de las server actions.
    serverActions: { bodySizeLimit: "25mb" },
  },
};

export default nextConfig;

// Copia el worker de MapLibre a /public para servirlo como archivo estático.
// Next.js no empaqueta bien ese worker y sin él el mapa no dibuja ninguna capa.
import fs from "node:fs";
import path from "node:path";

const raiz = path.resolve(import.meta.dirname, "..");
const origen = path.join(raiz, "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs");
const destino = path.join(raiz, "public/maplibre/maplibre-gl-worker.mjs");
fs.mkdirSync(path.dirname(destino), { recursive: true });
fs.copyFileSync(origen, destino);
console.log("Worker de MapLibre copiado a public/maplibre/");

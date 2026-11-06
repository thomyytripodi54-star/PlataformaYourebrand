"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import * as maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";

// El worker se sirve desde /public (lo copia scripts/copiar-worker-mapa.mjs en cada build).
maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

export type PuntoCliente = {
  id: string;
  nombre: string;
  logo: string | null;
  lat: number;
  lng: number;
  lugar: string;
  casos: number;
  followUp?: boolean;
  satisfaccion?: "Contento" | "Expectante" | "Insatisfecho" | null;
};

type Encuadre = [number, number, number, number];
type FC = GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, { nombre?: string; name?: string }>;

// Paleta del manual de marca
const C = {
  agua: "#eceae6",
  tierra: "#ffffff",
  borde: "#d4d4d4",
  bordeFuerte: "#a9a8a8",
  grafito: "#272626",
  rojo: "#d30805",
  rojo20: "#f6cecd",
};

/* ---------- geometría ---------- */
function anillos(g: GeoJSON.Polygon | GeoJSON.MultiPolygon): GeoJSON.Position[][][] {
  return g.type === "Polygon" ? [g.coordinates] : g.coordinates;
}
function dentro([x, y]: [number, number], g: GeoJSON.Polygon | GeoJSON.MultiPolygon) {
  return anillos(g).some((poly) => {
    let adentro = false;
    const ring = poly[0];
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) adentro = !adentro;
    }
    return adentro;
  });
}
/** Centro aproximado (del anillo exterior más grande) para ubicar el nombre del partido. */
function centro(g: GeoJSON.Polygon | GeoJSON.MultiPolygon): [number, number] {
  const ring = anillos(g).map((p) => p[0]).sort((a, b) => b.length - a.length)[0];
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const iniciales = (n: string) => n.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

function crearMarcador(p: PuntoCliente, onClick: () => void) {
  // MapLibre posiciona el contenedor; la animación va en el botón interno.
  const pin = document.createElement("div");
  const el = document.createElement("button");
  pin.appendChild(el);
  el.type = "button";
  el.className = `yb-marcador${p.satisfaccion ? ` sat-${p.satisfaccion.toLowerCase()}` : ""}`;
  el.setAttribute("aria-label", p.nombre);
  el.innerHTML = `
    <span class="yb-marcador-logo">${p.logo ? `<img src="${esc(p.logo)}" alt="" />` : esc(iniciales(p.nombre))}</span>
    ${p.casos ? `<span class="yb-marcador-alerta">${p.casos}</span>` : ""}
    ${p.followUp ? `<span class="yb-marcador-fu" title="Follow up pendiente"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span>` : ""}
    <span class="yb-marcador-nombre">${esc(p.nombre)}</span>`;
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  return { pin, el };
}

/** Mapa propio (sin proveedores externos): países, provincias, partidos del AMBA y comunas de CABA. */
function estilo(): maplibregl.StyleSpecification {
  const vacio: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
  const src = (): maplibregl.GeoJSONSourceSpecification => ({ type: "geojson", data: vacio });
  return {
    version: 8,
    sources: { mundo: src(), provincias: src(), partidos: { ...src(), promoteId: "nombre" }, caba: src(), comunas: src() },
    layers: [
      { id: "agua", type: "background", paint: { "background-color": C.agua } },
      { id: "mundo", type: "fill", source: "mundo", paint: { "fill-color": C.tierra } },
      { id: "mundo-borde", type: "line", source: "mundo", paint: { "line-color": C.borde, "line-width": 0.6 } },
      { id: "provincias-borde", type: "line", source: "provincias", paint: { "line-color": C.bordeFuerte, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.4, 8, 1.2] } },
      {
        id: "partidos",
        type: "fill",
        source: "partidos",
        paint: {
          "fill-color": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            "#ececec",
            ["boolean", ["feature-state", "clientes"], false],
            C.rojo20,
            C.tierra,
          ],
          "fill-opacity": 0,
          "fill-opacity-transition": { duration: 900, delay: 300 },
        },
      },
      {
        id: "partidos-borde",
        type: "line",
        source: "partidos",
        paint: { "line-color": "#8a8988", "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.5, 11, 1.4], "line-opacity": 0, "line-opacity-transition": { duration: 1200, delay: 200 } },
      },
      { id: "comunas", type: "line", source: "comunas", paint: { "line-color": C.borde, "line-width": 0.8, "line-dasharray": [2, 2] } },
      { id: "caba", type: "fill", source: "caba", paint: { "fill-color": C.grafito, "fill-opacity": 0.06 } },
      { id: "caba-borde", type: "line", source: "caba", paint: { "line-color": C.grafito, "line-width": ["interpolate", ["linear"], ["zoom"], 7, 1, 12, 2.5] } },
    ],
  };
}

export function MapaZoom({
  puntos,
  encuadre,
  seleccionado,
  onSeleccionar,
  animado = true,
}: {
  animado?: boolean;
  puntos: PuntoCliente[];
  encuadre: Encuadre;
  seleccionado: string | null;
  onSeleccionar: (id: string | null) => void;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<maplibregl.Map | null>(null);
  const animadoRef = useRef(animado);
  const partidos = useRef<FC | null>(null);
  const etiquetas = useRef<maplibregl.Marker[]>([]);
  const marcadores = useRef(new Map<string, { m: maplibregl.Marker; el: HTMLElement; p: PuntoCliente }>());
  const onSel = useRef(onSeleccionar);
  useEffect(() => {
    onSel.current = onSeleccionar;
  }, [onSeleccionar]);
  const puntosRef = useRef(puntos);
  useEffect(() => {
    puntosRef.current = puntos;
  }, [puntos]);

  /** Marca en rojo suave los partidos donde hay clientes. */
  const marcarPartidos = () => {
    const m = mapa.current;
    const fc = partidos.current;
    if (!m || !fc || !m.getSource("partidos")) return;
    for (const f of fc.features) {
      const tiene = puntosRef.current.some((p) => dentro([p.lng, p.lat], f.geometry));
      m.setFeatureState({ source: "partidos", id: f.properties.nombre }, { clientes: tiene });
    }
  };

  // Crear el mapa una sola vez: arranca en la vista del país y "vuela" hasta el encuadre.
  useEffect(() => {
    if (!contenedor.current) return;
    const centroIni: [number, number] = [(encuadre[0] + encuadre[2]) / 2, (encuadre[1] + encuadre[3]) / 2];
    const m = new maplibregl.Map({
      container: contenedor.current,
      style: estilo(),
      // Con animación arranca de lejos y "vuela"; sin animación abre directo en el encuadre.
      ...(animado ? { center: centroIni, zoom: 3 } : { bounds: encuadre, fitBoundsOptions: { padding: 40, maxZoom: 13 } }),
      attributionControl: false,
      fadeDuration: 0,
      renderWorldCopies: false,
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    m.on("click", () => onSel.current(null));
    mapa.current = m;
    contenedor.current.setAttribute("data-estilo", "local");

    let vivo = true;
    m.once("load", async () => {
      const cargar = async (n: string) => (await fetch(`/geo/${n}.geojson`)).json();
      const [mundo, provincias, part, caba, comunas] = await Promise.all(["mundo", "provincias", "partidos", "caba", "comunas"].map(cargar));
      if (!vivo) return;
      (m.getSource("mundo") as maplibregl.GeoJSONSource).setData(mundo);
      (m.getSource("provincias") as maplibregl.GeoJSONSource).setData(provincias);
      (m.getSource("partidos") as maplibregl.GeoJSONSource).setData(part);
      (m.getSource("caba") as maplibregl.GeoJSONSource).setData(caba);
      (m.getSource("comunas") as maplibregl.GeoJSONSource).setData(comunas);
      partidos.current = part;
      // Aparición animada de los partidos (instantánea si no hay animación)
      if (!animado) {
        m.setPaintProperty("partidos", "fill-opacity-transition", { duration: 0, delay: 0 });
        m.setPaintProperty("partidos-borde", "line-opacity-transition", { duration: 0, delay: 0 });
      }
      m.setPaintProperty("partidos", "fill-opacity", 1);
      m.setPaintProperty("partidos-borde", "line-opacity", 0.9);
      m.once("idle", marcarPartidos);

      // Nombres de partidos (HTML, visibles desde cierto zoom)
      for (const f of (part as FC).features) {
        // MapLibre controla la opacidad del contenedor del marcador; el texto va en un elemento interno.
        const el = document.createElement("div");
        const txt = document.createElement("span");
        txt.className = "yb-partido";
        txt.textContent = f.properties.nombre ?? "";
        el.appendChild(txt);
        etiquetas.current.push(new maplibregl.Marker({ element: el }).setLngLat(centro(f.geometry)).addTo(m));
      }
      // Los nombres solo se muestran de cerca (se controla en cada etiqueta, no con clases del contenedor).
      const visibilidad = () => {
        const ver = m.getZoom() >= 8.6;
        for (const e of etiquetas.current) (e.getElement().firstElementChild as HTMLElement).style.opacity = ver ? "1" : "0";
      };
      m.on("zoom", visibilidad);
      visibilidad();

      // Hover de partidos
      let hover: string | null = null;
      m.on("mousemove", "partidos", (e) => {
        const id = e.features?.[0]?.id as string | undefined;
        if (id === hover) return;
        if (hover) m.setFeatureState({ source: "partidos", id: hover }, { hover: false });
        hover = id ?? null;
        if (hover) m.setFeatureState({ source: "partidos", id: hover }, { hover: true });
      });
      m.on("mouseleave", "partidos", () => {
        if (hover) m.setFeatureState({ source: "partidos", id: hover }, { hover: false });
        hover = null;
      });
    });

    const t = animado ? setTimeout(() => m.fitBounds(encuadre, { padding: 40, maxZoom: 13, duration: 2400, curve: 1.6, essential: true }), 350) : undefined;
    const marks = marcadores.current;
    const labels = etiquetas.current;
    return () => {
      vivo = false;
      clearTimeout(t);
      marks.clear();
      labels.length = 0;
      m.remove();
      mapa.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cambios de encuadre (CABA y GBA ↔ toda Argentina)
  const primera = useRef(true);
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    mapa.current?.fitBounds(encuadre, { padding: 40, maxZoom: 13, duration: 1800, curve: 1.4, essential: true });
  }, [encuadre]);

  // Marcadores: los que comparten lugar se acomodan en ronda para que se vean todos.
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    const grupos = new Map<string, PuntoCliente[]>();
    for (const p of puntos) {
      const k = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
      grupos.set(k, [...(grupos.get(k) ?? []), p]);
    }
    const vigentes = new Set<string>();
    for (const grupo of grupos.values()) {
      grupo.forEach((p, i) => {
        vigentes.add(p.id);
        const n = grupo.length;
        const radio = n === 1 ? 0 : 22 + n * 2;
        const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
        const offset: [number, number] = [Math.cos(ang) * radio, Math.sin(ang) * radio];
        const prev = marcadores.current.get(p.id);
        if (prev && prev.p.followUp === p.followUp && prev.p.casos === p.casos && prev.p.satisfaccion === p.satisfaccion) {
          prev.m.setLngLat([p.lng, p.lat]).setOffset(offset);
          return;
        }
        // Cambió algo que se ve en el marcador (follow up, casos, satisfacción): se rehace sin animación.
        if (prev) {
          prev.m.remove();
          marcadores.current.delete(p.id);
        }
        const { pin, el } = crearMarcador(p, () => onSel.current(p.id));
        if (prev || !animadoRef.current) el.classList.add("yb-sin-anim");
        else el.style.animationDelay = `${1.2 + (i % 6) * 0.08 + Math.random() * 0.6}s`;
        const mk = new maplibregl.Marker({ element: pin, offset }).setLngLat([p.lng, p.lat]).addTo(m);
        marcadores.current.set(p.id, { m: mk, el, p });
      });
    }
    for (const [id, x] of marcadores.current) {
      if (!vigentes.has(id)) {
        x.m.remove();
        marcadores.current.delete(id);
      }
    }
    marcarPartidos();
  }, [puntos]);

  // Selección: resalta el marcador y vuela hasta el cliente.
  useEffect(() => {
    for (const [id, x] of marcadores.current) x.el.classList.toggle("activo", id === seleccionado);
    const s = seleccionado && marcadores.current.get(seleccionado);
    // Sin zoom: solo centra el cliente, manteniendo el nivel de acercamiento actual.
    if (s && mapa.current) {
      mapa.current.easeTo({ center: [s.p.lng, s.p.lat], offset: [0, -60], duration: 900, essential: true });
    }
  }, [seleccionado]);

  return <div ref={contenedor} className="yb-mapa h-full w-full" />;
}

"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";

export type PuntoCliente = {
  id: string;
  nombre: string;
  logo: string | null;
  lat: number;
  lng: number;
  lugar: string;
  casos: number;
};

type Encuadre = [number, number, number, number];

const ESTILO = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
// Si el proveedor de mapas no responde, se usa un fondo liso para que el mapa y el zoom igual funcionen.
const RESPALDO: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "fondo", type: "background", paint: { "background-color": "#1b1a1a" } }],
};

function iniciales(n: string) {
  return n.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

/** Marcador HTML: logo o iniciales del cliente, con punto rojo si tiene casos abiertos. */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

function crearMarcador(p: PuntoCliente, onClick: () => void) {
  // MapLibre posiciona el contenedor; la animación va en el botón interno.
  const pin = document.createElement("div");
  const el = document.createElement("button");
  pin.appendChild(el);
  el.type = "button";
  el.className = "yb-marcador";
  el.setAttribute("aria-label", p.nombre);
  el.innerHTML = `
    <span class="yb-marcador-logo">${p.logo ? `<img src="${esc(p.logo)}" alt="" />` : esc(iniciales(p.nombre))}</span>
    ${p.casos ? `<span class="yb-marcador-alerta">${p.casos}</span>` : ""}
    <span class="yb-marcador-nombre">${esc(p.nombre)}</span>`;
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  return { pin, el };
}

export function MapaZoom({
  puntos,
  encuadre,
  seleccionado,
  onSeleccionar,
}: {
  puntos: PuntoCliente[];
  encuadre: Encuadre;
  seleccionado: string | null;
  onSeleccionar: (id: string | null) => void;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<maplibregl.Map | null>(null);
  const marcadores = useRef(new Map<string, { m: maplibregl.Marker; el: HTMLElement; p: PuntoCliente }>());
  const onSel = useRef(onSeleccionar);
  useEffect(() => {
    onSel.current = onSeleccionar;
  }, [onSeleccionar]);

  // Crear el mapa una sola vez: arranca lejos y "vuela" hasta el país.
  useEffect(() => {
    if (!contenedor.current) return;
    const centro: [number, number] = [(encuadre[0] + encuadre[2]) / 2, (encuadre[1] + encuadre[3]) / 2];
    const m = new maplibregl.Map({
      container: contenedor.current,
      style: ESTILO,
      center: centro,
      zoom: 1.6,
      pitch: 0,
      attributionControl: { compact: true },
      fadeDuration: 0,
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    m.on("click", () => onSel.current(null));
    let respaldo = false;
    const usarRespaldo = () => {
      if (respaldo || m.isStyleLoaded()) return;
      respaldo = true;
      m.setStyle(RESPALDO);
    };
    m.on("error", usarRespaldo);
    const tEstilo = setTimeout(usarRespaldo, 6000);
    mapa.current = m;
    // El vuelo arranca enseguida: la cámara no necesita que hayan cargado las calles.
    const t = setTimeout(() => m.fitBounds(encuadre, { padding: 50, duration: 2600, curve: 1.6, pitch: 30, essential: true }), 350);
    const marks = marcadores.current;
    return () => {
      clearTimeout(t);
      clearTimeout(tEstilo);
      marks.clear();
      m.remove();
      mapa.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cambios de encuadre (p. ej. "Ver toda Argentina")
  const primera = useRef(true);
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    mapa.current?.fitBounds(encuadre, { padding: 50, duration: 2200, curve: 1.5, essential: true });
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
        if (prev) {
          prev.m.setLngLat([p.lng, p.lat]).setOffset(offset);
          return;
        }
        const { pin, el } = crearMarcador(p, () => onSel.current(p.id));
        el.style.animationDelay = `${0.9 + (i % 6) * 0.08 + Math.random() * 0.6}s`;
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
  }, [puntos]);

  // Selección: resalta el marcador y vuela hasta el cliente.
  useEffect(() => {
    for (const [id, x] of marcadores.current) x.el.classList.toggle("activo", id === seleccionado);
    const s = seleccionado && marcadores.current.get(seleccionado);
    if (s && mapa.current) mapa.current.flyTo({ center: [s.p.lng, s.p.lat], zoom: Math.max(mapa.current.getZoom(), 12.5), duration: 1600, essential: true });
  }, [seleccionado]);

  return <div ref={contenedor} className="yb-mapa h-full w-full" />;
}

"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/*
 * Dictado por voz con el reconocimiento del navegador (Web Speech API): gratis, sin servidor,
 * en español rioplatense. Lo traen Chrome, Edge y Safari; en Firefox el botón no aparece.
 */

type Resultado = { isFinal: boolean; 0: { transcript: string } };
type Reconocedor = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<Resultado> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type ConstructorReconocedor = new () => Reconocedor;

function constructorReconocedor(): ConstructorReconocedor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: ConstructorReconocedor; webkitSpeechRecognition?: ConstructorReconocedor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
const sinSuscripcion = () => () => {};

const MENSAJES: Record<string, string> = {
  "not-allowed": "Permití el uso del micrófono en el navegador para dictar.",
  "service-not-allowed": "Permití el uso del micrófono en el navegador para dictar.",
  "audio-capture": "No se encontró un micrófono.",
  network: "El dictado necesita conexión a internet.",
};

/**
 * Botón de micrófono: mientras escuchás, va escribiendo en el campo lo que decís (se suma a lo que ya había).
 * `onCambio` recibe el texto completo del campo.
 */
export function Microfono({ valor, onCambio, className = "" }: { valor: string; onCambio: (texto: string) => void; className?: string }) {
  const soportado = useSyncExternalStore(sinSuscripcion, () => !!constructorReconocedor(), () => false);
  const [escuchando, setEscuchando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Reconocedor | null>(null);
  const valorRef = useRef(valor);
  useEffect(() => {
    // Si el campo se vacía (se envió la pregunta) mientras se dicta, se corta el dictado.
    if (!valor && valorRef.current && rec.current) rec.current.abort();
    valorRef.current = valor;
  }, [valor]);
  useEffect(() => () => rec.current?.abort(), []);

  if (!soportado) return null;

  const empezar = () => {
    const R = constructorReconocedor();
    if (!R) return;
    const base = valorRef.current.trimEnd();
    const r = new R();
    r.lang = "es-AR";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let dicho = "";
      for (let i = 0; i < e.results.length; i++) dicho += e.results[i][0].transcript;
      dicho = dicho.trim();
      if (dicho) onCambio(`${base}${base ? " " : ""}${dicho.charAt(0).toUpperCase()}${dicho.slice(1)}`);
    };
    r.onerror = (e) => {
      if (e.error !== "aborted" && e.error !== "no-speech") setError(MENSAJES[e.error] ?? "No se pudo usar el dictado. Probá de nuevo.");
    };
    r.onend = () => setEscuchando(false);
    rec.current = r;
    setError(null);
    setEscuchando(true);
    r.start();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => (escuchando ? rec.current?.stop() : empezar())}
        aria-label={escuchando ? "Dejar de dictar" : "Dictar por voz"}
        title={escuchando ? "Dejar de dictar" : "Dictar por voz"}
        className={`relative flex shrink-0 items-center justify-center rounded-2xl border transition-colors ${
          escuchando ? "border-[#d30805] bg-[#d30805] text-white" : "border-white/20 text-white/75 hover:border-white/50 hover:text-white"
        } ${className}`}
      >
        {escuchando && <span className="absolute inset-0 animate-ping rounded-2xl bg-[#d30805]/40" />}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="relative h-4 w-4" aria-hidden>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
      </button>
      {error && <p className="basis-full text-[11px] text-white/70">{error}</p>}
    </>
  );
}

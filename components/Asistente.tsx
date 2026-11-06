"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const ease = [0.22, 1, 0.36, 1] as const;
const CLAVE = "yb-asistente";
type Mensaje = { rol: "user" | "assistant"; texto: string };
type Estado = { listo: boolean; proyecto: string | null; planilla: { origen: "en vivo" | "copia"; actualizado: string; error?: string; cuenta?: string } };

const PROYECTOS = "https://claude.ai/projects";

/**
 * Sin clave de API: el asistente es un proyecto de claude.ai (incluido en el plan de Claude, sin costo extra).
 * Desde acá se abre el proyecto, se lleva la pregunta copiada y, si hace falta, los datos que solo están en la plataforma.
 */
function ModoProyecto({ proyecto }: { proyecto: string | null }) {
  const [pregunta, setPregunta] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const url = proyecto || PROYECTOS;
  const avisar = (t: string) => {
    setAviso(t);
    setTimeout(() => setAviso(null), 4000);
  };
  const copiar = async (t: string) => {
    try {
      await navigator.clipboard.writeText(t);
      return true;
    } catch {
      return false;
    }
  };
  const preguntarEnClaude = async () => {
    const q = pregunta.trim();
    if (!q) return window.open(url, "_blank", "noopener");
    const ok = await copiar(q);
    window.open(url, "_blank", "noopener");
    avisar(ok ? "Pregunta copiada: pegala en el chat del proyecto (Ctrl+V / ⌘V)." : "Abrí el proyecto y escribí la pregunta ahí.");
    setPregunta("");
  };
  const copiarDatos = async () => {
    avisar("Preparando los datos…");
    try {
      const r = await fetch("/api/asistente/contexto");
      if (!r.ok) throw new Error();
      avisar((await copiar(await r.text())) ? "Datos copiados: pegalos en el chat junto con tu pregunta." : "No se pudo copiar: usá «Descargar».");
    } catch {
      avisar("No se pudieron preparar los datos. Probá de nuevo.");
    }
  };
  return (
    <div className="flex h-full flex-col justify-end text-[13px]">
      <p className="text-sm text-white/70">
        Tu asistente vive en un <b className="text-white">proyecto de Claude</b>: las consultas entran en tu plan, sin costo extra. Ahí Claude lee en vivo la planilla de Finanzas y Notion con tus
        conectores.
      </p>
      <a href={url} target="_blank" rel="noreferrer" className="mt-4 flex items-center justify-between rounded-2xl bg-white px-4 py-3 font-bold text-[#121111] transition-colors hover:bg-white/85">
        {proyecto ? "Abrir el proyecto en Claude" : "Ir a mis proyectos de Claude"} <span>↗</span>
      </a>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          preguntarEnClaude();
        }}
        className="mt-3 flex items-end gap-2"
      >
        <textarea
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              preguntarEnClaude();
            }
          }}
          rows={2}
          placeholder="Escribí la pregunta y la llevo copiada al proyecto…"
          className="min-h-[52px] flex-1 resize-none rounded-2xl bg-white/[0.07] px-3.5 py-2.5 text-white placeholder-white/35 outline-none focus:bg-white/[0.1]"
        />
        <button
          type="submit"
          disabled={!pregunta.trim()}
          className="h-[52px] shrink-0 rounded-2xl border border-white/20 px-3.5 text-xs font-bold text-white/85 hover:border-white/50 disabled:opacity-30"
        >
          Preguntar ↗
        </button>
      </form>
      <div className="mt-4 rounded-2xl border border-white/10 p-3.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/45">Datos de la plataforma</p>
        <p className="mt-1 text-[12px] leading-snug text-white/55">Follow ups, meses consolidados acá y un resumen de todo lo demás. Pegalos en la charla cuando los necesite.</p>
        <div className="mt-2.5 flex gap-2">
          <button onClick={copiarDatos} className="rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold hover:bg-white/20">
            Copiar datos
          </button>
          <a href="/api/asistente/contexto?descargar=1" className="rounded-full px-3.5 py-1.5 text-xs font-semibold text-white/60 hover:bg-white/10 hover:text-white">
            Descargar (.md)
          </a>
        </div>
      </div>
      <AnimatePresence>
        {aviso && (
          <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 text-[12px] text-white/75">
            {aviso}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/** De dónde lee el asistente: se ve al abrir el chat, para saber si la planilla está en vivo. */
function Fuentes({ estado }: { estado: Estado | null }) {
  if (!estado) return null;
  const { planilla: p } = estado;
  const enVivo = p.origen === "en vivo";
  return (
    <div className="mt-4 space-y-1 rounded-2xl border border-white/10 px-3.5 py-2.5 text-[11px] leading-snug text-white/55">
      {!estado.listo && <p className="text-white/80">Falta configurar ANTHROPIC_API_KEY en Vercel para que pueda responder.</p>}
      <p className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${enVivo ? "bg-emerald-400" : "bg-amber-400"}`} />
        Planilla de finanzas: {enVivo ? "en vivo" : `copia del ${p.actualizado.split("-").reverse().join("/")}`}
      </p>
      {p.error && <p className="text-white/75">{p.error}</p>}
    </div>
  );
}

const SUGERENCIAS = [
  "¿Cómo venimos contra los objetivos 2026?",
  "¿Qué campaña nos trae clientes más baratos?",
  "¿Qué clientes están en riesgo de baja y qué hago?",
  "Proponeme objetivos para el próximo trimestre",
];

function cargar(): Mensaje[] {
  try {
    return JSON.parse(sessionStorage.getItem(CLAVE) ?? "[]") as Mensaje[];
  } catch {
    return [];
  }
}

function Icono({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 3.5l1.6 4.3a4 4 0 002.6 2.6l4.3 1.6-4.3 1.6a4 4 0 00-2.6 2.6L12 20.5l-1.6-4.3a4 4 0 00-2.6-2.6L3.5 12l4.3-1.6a4 4 0 002.6-2.6L12 3.5z" />
    </svg>
  );
}

/** Texto en Markdown con estilos del panel (sin depender del tema de las páginas). */
function Respuesta({ texto }: { texto: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: (p) => <p className="mb-2 last:mb-0" {...p} />,
        ul: (p) => <ul className="mb-2 list-disc space-y-1 pl-4 last:mb-0" {...p} />,
        ol: (p) => <ol className="mb-2 list-decimal space-y-1 pl-4 last:mb-0" {...p} />,
        h1: (p) => <p className="mb-1.5 mt-3 font-black first:mt-0" {...p} />,
        h2: (p) => <p className="mb-1.5 mt-3 font-black first:mt-0" {...p} />,
        h3: (p) => <p className="mb-1 mt-2.5 font-bold first:mt-0" {...p} />,
        strong: (p) => <strong className="font-bold text-white" {...p} />,
        a: (p) => <a className="underline decoration-white/30 underline-offset-2 hover:text-white" target="_blank" rel="noreferrer" {...p} />,
        table: (p) => (
          <div className="mb-2 overflow-x-auto rounded-lg border border-white/10 last:mb-0">
            <table className="w-full text-left text-[12px]" {...p} />
          </div>
        ),
        th: (p) => <th className="whitespace-nowrap border-b border-white/10 bg-white/[0.04] px-2 py-1 font-semibold" {...p} />,
        td: (p) => <td className="border-b border-white/5 px-2 py-1 tabular-nums" {...p} />,
        code: (p) => <code className="rounded bg-white/10 px-1 text-[12px]" {...p} />,
      }}
    >
      {texto}
    </ReactMarkdown>
  );
}

/**
 * Asistente de dirección: un círculo en la esquina que abre un chat de consulta.
 * Solo lee y aconseja (ver app/api/asistente). La conversación queda guardada en esta pestaña.
 */
export function Asistente() {
  const path = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>(() => (typeof window === "undefined" ? [] : cargar()));
  const [texto, setTexto] = useState("");
  const [respondiendo, setRespondiendo] = useState(false);
  const [estado, setEstado] = useState<Estado | null>(null);
  const corte = useRef<AbortController | null>(null);
  const lista = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(CLAVE, JSON.stringify(mensajes));
    } catch {}
    lista.current?.scrollTo({ top: lista.current.scrollHeight, behavior: "smooth" });
  }, [mensajes]);

  // Al abrir, se consulta de dónde lee (planilla en vivo o copia).
  useEffect(() => {
    if (!abierto) return;
    let vivo = true;
    fetch("/api/asistente")
      .then((r) => (r.ok ? r.json() : null))
      .then((e: Estado | null) => vivo && setEstado(e))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [abierto]);

  useEffect(() => {
    if (abierto) entrada.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [abierto]);

  if (path.startsWith("/login")) return null;

  const preguntar = async (pregunta: string) => {
    const q = pregunta.trim();
    if (!q || respondiendo) return;
    const historial: Mensaje[] = [...mensajes, { rol: "user", texto: q }];
    setMensajes([...historial, { rol: "assistant", texto: "" }]);
    setTexto("");
    setRespondiendo(true);
    const control = new AbortController();
    corte.current = control;
    const agregar = (t: string) =>
      setMensajes((ms) => {
        const copia = [...ms];
        copia[copia.length - 1] = { rol: "assistant", texto: copia[copia.length - 1].texto + t };
        return copia;
      });
    try {
      // Solo se mandan los turnos completos (sin respuestas vacías de consultas cortadas).
      const enviar = historial.filter((m, i) => m.texto.trim() && !(m.rol === "user" && historial[i + 1]?.rol === "user"));
      const r = await fetch("/api/asistente", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mensajes: enviar }), signal: control.signal });
      if (!r.ok || !r.body) {
        agregar(`_${(await r.text().catch(() => "")) || "No se pudo conectar con el asistente."}_`);
        return;
      }
      const lector = r.body.getReader();
      const decodificar = new TextDecoder();
      for (;;) {
        const { value, done } = await lector.read();
        if (done) break;
        agregar(decodificar.decode(value, { stream: true }));
      }
    } catch {
      if (!control.signal.aborted) agregar("_Se cortó la conexión. Probá de nuevo._");
    } finally {
      setRespondiendo(false);
      corte.current = null;
      // Una respuesta que quedó vacía (cancelada antes de empezar) se marca para que no viaje vacía.
      setMensajes((ms) => (ms[ms.length - 1]?.rol === "assistant" && !ms[ms.length - 1].texto ? [...ms.slice(0, -1), { rol: "assistant", texto: "_(Consulta cancelada.)_" }] : ms));
    }
  };

  return (
    <>
      <AnimatePresence>
        {abierto && (
          <motion.section
            key="panel"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97, transition: { duration: 0.2 } }}
            transition={{ duration: 0.35, ease }}
            style={{ transformOrigin: "bottom right" }}
            className="fixed bottom-20 right-4 z-[90] flex h-[min(620px,calc(100dvh-7rem))] w-[min(430px,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#161515]/95 text-white shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl md:right-5"
            aria-label="Asistente"
          >
            <header className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                <Icono className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-black leading-none tracking-tight">
                  Asistente<span className="text-[#d30805]">.</span>
                </p>
                <p className="mt-1 text-[11px] text-white/45">
                  {estado && !estado.listo ? "Tu proyecto de Claude con los datos de la agencia" : "Consultas y consejos con los datos de la agencia · solo lectura"}
                </p>
              </div>
              {mensajes.length > 0 && (
                <button
                  onClick={() => {
                    corte.current?.abort();
                    setMensajes([]);
                  }}
                  className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white/50 hover:bg-white/10 hover:text-white"
                >
                  Nueva
                </button>
              )}
              <button onClick={() => setAbierto(false)} aria-label="Cerrar" className="text-xl leading-none text-white/40 hover:text-white">
                ×
              </button>
            </header>

            <div ref={lista} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4 text-[13px] leading-relaxed">
              {estado && !estado.listo && mensajes.length === 0 ? (
                <ModoProyecto proyecto={estado.proyecto} />
              ) : mensajes.length === 0 ? (
                <div className="flex h-full flex-col justify-end">
                  <p className="text-sm text-white/60">
                    Preguntame sobre el estado de resultados, publicidad y ventas, clientes, equipo u objetivos. Te respondo con los números de la plataforma, Notion y la planilla de finanzas.
                  </p>
                  <div className="mt-4 flex flex-col gap-2">
                    {SUGERENCIAS.map((s) => (
                      <button
                        key={s}
                        onClick={() => preguntar(s)}
                        className="rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-left text-[13px] text-white/80 transition-colors hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <Fuentes estado={estado} />
                </div>
              ) : (
                mensajes.map((m, i) =>
                  m.rol === "user" ? (
                    <div key={i} className="ml-8 rounded-2xl rounded-br-md bg-white/[0.09] px-3.5 py-2.5 whitespace-pre-wrap">
                      {m.texto}
                    </div>
                  ) : (
                    <div key={i} className="text-white/85">
                      {m.texto ? (
                        <Respuesta texto={m.texto} />
                      ) : (
                        <span className="inline-flex items-center gap-2 text-white/45">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#d30805]" /> Analizando los datos…
                        </span>
                      )}
                    </div>
                  ),
                )
              )}
            </div>

            {(!estado || estado.listo || mensajes.length > 0) && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  preguntar(texto);
                }}
                className="flex items-end gap-2 border-t border-white/10 p-3"
              >
                <textarea
                  ref={entrada}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      preguntar(texto);
                    }
                  }}
                  rows={1}
                  maxLength={8000}
                  placeholder="Escribí tu consulta…"
                  className="max-h-32 min-h-[42px] flex-1 resize-none rounded-2xl bg-white/[0.07] px-3.5 py-2.5 text-[13px] text-white placeholder-white/35 outline-none focus:bg-white/[0.1]"
                />
                {respondiendo ? (
                  <button
                    type="button"
                    onClick={() => corte.current?.abort()}
                    className="h-[42px] shrink-0 rounded-2xl border border-white/20 px-3.5 text-xs font-bold text-white/80 hover:border-white/50"
                  >
                    Detener
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!texto.trim()}
                    className="h-[42px] shrink-0 rounded-2xl bg-white px-4 text-xs font-bold text-[#121111] transition-colors hover:bg-white/85 disabled:opacity-30"
                  >
                    Enviar
                  </button>
                )}
              </form>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setAbierto((a) => !a)}
        aria-label={abierto ? "Cerrar asistente" : "Abrir asistente"}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.07 }}
        whileTap={{ scale: 0.94 }}
        transition={{ duration: 0.4, ease }}
        className="group fixed bottom-5 right-4 z-[90] flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-[#1d1c1c]/90 text-white shadow-[0_10px_30px_-10px_rgba(0,0,0,0.8)] backdrop-blur-xl md:right-5"
      >
        <span className="pointer-events-none absolute inset-0 rounded-full bg-[#d30805]/0 blur-md transition-colors duration-500 group-hover:bg-[#d30805]/30" />
        <AnimatePresence mode="wait" initial={false}>
          {abierto ? (
            <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} className="relative text-xl leading-none">
              ×
            </motion.span>
          ) : (
            <motion.span key="i" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} className="relative">
              <Icono className="h-5 w-5" />
            </motion.span>
          )}
        </AnimatePresence>
        {respondiendo && !abierto && <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-[#d30805]" />}
      </motion.button>
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";

const ease = [0.22, 1, 0.36, 1] as const;
const PROYECTOS = "https://claude.ai/projects";

function Icono({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 3.5l1.6 4.3a4 4 0 002.6 2.6l4.3 1.6-4.3 1.6a4 4 0 00-2.6 2.6L12 20.5l-1.6-4.3a4 4 0 00-2.6-2.6L3.5 12l4.3-1.6a4 4 0 002.6-2.6L12 3.5z" />
    </svg>
  );
}

/**
 * Copia en el mismo clic, antes de abrir la otra pestaña: con execCommand funciona en Chrome, Safari y Firefox
 * aunque la página pierda el foco enseguida. El portapapeles moderno queda de respaldo.
 */
function copiar(texto: string): boolean {
  const area = document.createElement("textarea");
  area.value = texto;
  area.setAttribute("readonly", "");
  Object.assign(area.style, { position: "fixed", top: "0", left: "-9999px", opacity: "0" });
  document.body.appendChild(area);
  area.select();
  area.setSelectionRange(0, texto.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {}
  document.body.removeChild(area);
  if (!ok) navigator.clipboard?.writeText(texto).catch(() => {});
  return ok || !!navigator.clipboard;
}

/**
 * Asistente: el círculo de la esquina abre una caja para preguntarle a Claude.
 * El botón copia la pregunta y abre el proyecto de claude.ai (CLAUDE_PROYECTO_URL), donde se pega.
 */
export function Asistente({ proyecto }: { proyecto: string | null }) {
  const path = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [pregunta, setPregunta] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const entrada = useRef<HTMLTextAreaElement>(null);
  const url = proyecto || PROYECTOS;

  useEffect(() => {
    if (abierto) entrada.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [abierto]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  if (path.startsWith("/login")) return null;

  const preguntar = () => {
    const q = pregunta.trim();
    const copiado = q ? copiar(q) : false;
    window.open(url, "_blank", "noopener");
    if (q) {
      setAviso(copiado ? "Pregunta copiada: pegala en Claude con ⌘V / Ctrl+V." : "No se pudo copiar: escribila en Claude.");
      setPregunta("");
    }
  };

  return (
    <>
      <AnimatePresence>
        {abierto && (
          <motion.section
            key="panel"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97, transition: { duration: 0.18 } }}
            transition={{ duration: 0.3, ease }}
            style={{ transformOrigin: "bottom right" }}
            className="fixed bottom-20 right-4 z-[90] w-[min(360px,calc(100vw-2rem))] rounded-3xl border border-white/15 bg-[#161515]/95 p-4 text-white shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl md:right-5"
            aria-label="Asistente"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-base font-black tracking-tight">
                Preguntale a Claude<span className="text-[#d30805]">.</span>
              </p>
              <button onClick={() => setAbierto(false)} aria-label="Cerrar" className="text-xl leading-none text-white/40 hover:text-white">
                ×
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                preguntar();
              }}
            >
              <textarea
                ref={entrada}
                value={pregunta}
                onChange={(e) => setPregunta(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    preguntar();
                  }
                }}
                rows={3}
                placeholder="¿Qué querés consultar?"
                className="w-full resize-none rounded-2xl bg-white/[0.07] px-3.5 py-2.5 text-[13px] text-white placeholder-white/35 outline-none focus:bg-white/[0.1]"
              />
              <button type="submit" className="mt-2.5 flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm font-bold text-[#121111] transition-colors hover:bg-white/85">
                Preguntarle a Claude <span aria-hidden>↗</span>
              </button>
            </form>
            <AnimatePresence initial={false}>
              {aviso && (
                <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-2.5 text-[12px] text-white/75">
                  {aviso}
                </motion.p>
              )}
            </AnimatePresence>
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
      </motion.button>
    </>
  );
}

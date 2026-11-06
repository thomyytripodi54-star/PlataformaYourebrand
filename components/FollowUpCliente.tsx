"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { estado as calcular } from "@/lib/followup-calculo";
import { AnimatePresence, motion } from "motion/react";
import { definirFollowUp, marcarRevisado, registrarUltimo } from "@/app/clientes/actions";

const ease = [0.22, 1, 0.36, 1] as const;
const OPCIONES = [
  { dias: 7, label: "7 días" },
  { dias: 15, label: "15 días" },
  { dias: 30, label: "30 días" },
  { dias: 90, label: "3 meses" },
];
const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "long", timeZone: "America/Argentina/Buenos_Aires" });

export type FollowUpVista = { cada: number; ultimo: string; proximo: string; vencido: boolean; dias: number } | null;

export function FollowUpCliente({ id, estado: inicial }: { id: string; estado: FollowUpVista }) {
  // El cambio se muestra al instante y se guarda en segundo plano; si falla, vuelve atrás.
  const [estado, setEstado] = useState<FollowUpVista>(inicial);
  const [, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const confirmado = useRef(inicial);
  // Si el servidor manda datos nuevos, pasan a ser los vigentes.
  const [previo, setPrevio] = useState(inicial);
  if (previo !== inicial) {
    setPrevio(inicial);
    setEstado(inicial);
  }
  useEffect(() => {
    confirmado.current = inicial;
  }, [inicial]);
  const correr = (nuevo: FollowUpVista, fn: () => Promise<{ error?: string }>) => {
    setEstado(nuevo);
    setError(null);
    iniciar(async () => {
      try {
        const r = await fn();
        if (r.error) {
          setEstado(confirmado.current);
          setError(r.error);
        } else confirmado.current = nuevo;
      } catch {
        setEstado(confirmado.current);
        setError("No se pudo guardar. Probá de nuevo.");
      }
    });
  };
  const ahora = () => new Date().toISOString();
  const con = (cada: number, ultimo: string): FollowUpVista => calcular({ cada, ultimo });

  return (
    <section className={`rounded-2xl border bg-white p-4 transition-colors ${estado?.vencido ? "border-white/40" : "border-zinc-200"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
          Follow up
          {estado?.vencido && <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />}
        </h2>
        <div className="inline-flex rounded-full bg-surface p-1">
          {[...OPCIONES, { dias: 0, label: "No" }].map((o) => {
            const activo = (estado?.cada ?? 0) === o.dias;
            return (
              <button
                key={o.dias}
                onClick={() => !activo && correr(o.dias ? con(o.dias, estado?.cada === o.dias ? estado.ultimo : ahora()) : null, () => definirFollowUp(id, o.dias || null))}
                className="relative rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
              >
                {activo && <motion.span layoutId={`fu-${id}`} className="absolute inset-0 rounded-full bg-white/15" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
                <span className={`relative ${activo ? "text-white" : "text-white/50 hover:text-white"}`}>{o.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {estado ? (
          <motion.div key={estado.ultimo + estado.cada} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3, ease }} className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-2xl font-black tracking-tight">
                {estado.vencido ? (estado.dias === 0 ? "Toca hoy" : `Atrasado ${-estado.dias} ${-estado.dias === 1 ? "día" : "días"}`) : `En ${estado.dias} ${estado.dias === 1 ? "día" : "días"}`}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-zinc-500">
                Último:
                <label className="relative cursor-pointer underline decoration-white/20 underline-offset-2 hover:text-white" title="Cambiar la fecha del último follow up">
                  {fecha(estado.ultimo)}
                  <input
                    type="date"
                    max={new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" })}
                    defaultValue={new Date(estado.ultimo).toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" })}
                    onChange={(e) => e.target.value && correr(con(estado.cada, new Date(e.target.value + "T12:00:00-03:00").toISOString()), () => registrarUltimo(id, e.target.value))}
                    className="absolute inset-0 cursor-pointer opacity-0 [color-scheme:dark]"
                  />
                </label>
                · Próximo: {fecha(estado.proximo)}
              </p>
            </div>
            <button
              onClick={() => correr(con(estado.cada, ahora()), () => marcarRevisado(id))}
              className={`rounded-full px-4 py-2 text-xs font-bold transition-colors disabled:opacity-60 ${estado.vencido ? "bg-white/95 text-[#121111] hover:bg-white/80" : "border border-white/20 text-white/80 hover:border-white/50"}`}
            >
              ✓ Revisado
            </button>
          </motion.div>
        ) : (
          <motion.p key="sin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3 text-xs text-zinc-500">
            Sin follow up. Elegí cada cuánto querés revisarlo y te aviso en el inicio y en el mapa.
          </motion.p>
        )}
      </AnimatePresence>
      {error && <p className="mt-2 text-xs text-accent">{error}</p>}
    </section>
  );
}

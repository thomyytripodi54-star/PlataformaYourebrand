"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { Logo } from "@/components/Logo";
import { AREAS, clientesDe, equipo, nombreCliente, type Persona } from "@/lib/equipo";

const ease = [0.22, 1, 0.36, 1] as const;

const contenedor: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.5 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease } },
};

function iniciales(n: string) {
  return n.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

function Avatar({ p, size = 44, claro = false }: { p: Persona; size?: number; claro?: boolean }) {
  return (
    <motion.div
      layoutId={`avatar-${p.id}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${claro ? "bg-accent" : "bg-ink"}`}
    >
      {iniciales(p.nombre)}
    </motion.div>
  );
}

function Tarjeta({ p, onSelect, destacado = false }: { p: Persona; onSelect: (p: Persona) => void; destacado?: boolean }) {
  const casos = p.casosAbiertos.length;
  return (
    <motion.button
      variants={item}
      layoutId={`card-${p.id}`}
      onClick={() => onSelect(p)}
      whileHover={{ y: -3, boxShadow: "0 10px 30px -12px rgba(39,38,38,0.3)" }}
      whileTap={{ scale: 0.98 }}
      className={`group relative flex w-full items-center gap-3 rounded-2xl border bg-white p-3 text-left transition-colors ${
        destacado ? "border-ink" : "border-zinc-200 hover:border-accent"
      }`}
    >
      <Avatar p={p} size={destacado ? 52 : 44} />
      <div className="min-w-0 flex-1 pr-5">
        <p className="truncate text-sm font-semibold">{p.nombre}</p>
        <p className="truncate text-xs text-zinc-500">{p.rol}</p>
        <p className="mt-1 text-[11px] text-zinc-400">
          {p.clientes.length} {p.clientes.length === 1 ? "proyecto" : "proyectos"}
        </p>
      </div>
      {casos > 0 && (
        <span className="absolute right-2.5 top-2.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-white">
          {casos}
        </span>
      )}
    </motion.button>
  );
}

function Panel({ p, onClose }: { p: Persona; onClose: () => void }) {
  const proyectos = clientesDe(p);
  const tel = p.telefono?.replace(/[^\d+]/g, "");
  return (
    <>
      <motion.div
        className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.aside
        layoutId={`card-${p.id}`}
        className="fixed inset-x-3 bottom-3 top-16 z-50 overflow-y-auto rounded-3xl bg-white shadow-2xl sm:inset-x-auto sm:right-4 sm:top-4 sm:bottom-4 sm:w-[420px]"
        transition={{ duration: 0.45, ease }}
      >
        <div className="relative bg-ink px-6 pb-6 pt-8 text-white">
          <button onClick={onClose} aria-label="Cerrar" className="absolute right-4 top-4 rounded-full px-2 text-xl text-white/60 hover:text-white">
            ×
          </button>
          <Avatar p={p} size={72} claro />
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h2 className="mt-4 text-xl font-semibold">{p.nombre}</h2>
            <p className="mt-0.5 text-sm text-white/70">{p.rol}</p>
          </motion.div>
        </div>

        <motion.div
          className="space-y-6 p-6"
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.25 } } }}
        >
          <motion.section variants={item} className="grid grid-cols-1 gap-3">
            <Dato label="Teléfono">
              {tel ? (
                <a href={`https://wa.me/${tel.replace("+", "")}`} target="_blank" rel="noreferrer" className="hover:text-accent">
                  {p.telefono}
                </a>
              ) : (
                "—"
              )}
            </Dato>
            <Dato label="Gmail">
              {p.email ? (
                <a href={`mailto:${p.email}`} className="break-all hover:text-accent">
                  {p.email}
                </a>
              ) : (
                "—"
              )}
            </Dato>
          </motion.section>

          <motion.section variants={item}>
            <Titulo n={proyectos.length}>Proyectos asignados</Titulo>
            {proyectos.length ? (
              <ul className="mt-3 space-y-1.5">
                {proyectos.map((c) => (
                  <li key={c.id}>
                    <Link href={`/clientes/${c.id}`} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-surface">
                      <Logo cliente={c} size={28} />
                      <span className="text-sm">{c.nombre}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-zinc-400">Sin proyectos asignados</p>
            )}
          </motion.section>

          <motion.section variants={item}>
            <Titulo n={p.casosAbiertos.length}>Casos abiertos</Titulo>
            {p.casosAbiertos.length ? (
              <ul className="mt-3 space-y-2">
                {p.casosAbiertos.map((c) => (
                  <li key={c.notionUrl}>
                    <a href={c.notionUrl} target="_blank" rel="noreferrer" className="block rounded-xl border border-zinc-200 p-3 hover:border-accent">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{c.titulo}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            c.gravedad === "Leve" ? "bg-surface text-ink" : "bg-accent text-white"
                          }`}
                        >
                          {c.gravedad}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-500">
                        {nombreCliente(c.cliente)} · {c.fecha.split("-").reverse().join("/")}
                      </p>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-zinc-400">Sin casos abiertos.</p>
            )}
          </motion.section>
        </motion.div>
      </motion.aside>
    </>
  );
}

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-surface px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">{label}</p>
      <p className="mt-0.5 text-sm">{children}</p>
    </div>
  );
}

function Titulo({ children, n }: { children: React.ReactNode; n: number }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-semibold">
      {children}
      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent">{n}</span>
    </h3>
  );
}

export function Organigrama() {
  const [sel, setSel] = useState<Persona | null>(null);
  const owner = equipo.find((p) => p.area === "direccion");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSel(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="mx-auto max-w-7xl">
      <motion.header initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }} className="mb-10">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Recursos Humanos</p>
        <h1 className="mt-1 text-3xl font-black uppercase tracking-tight">
          Organigrama<span className="text-accent">.</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {equipo.length} personas · tocá a alguien para ver sus datos
        </p>
      </motion.header>

      {owner && (
        <div className="flex flex-col items-center">
          <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { delayChildren: 0.1 } } }} className="w-72">
            <Tarjeta p={owner} onSelect={setSel} destacado />
          </motion.div>
          <motion.div
            className="h-10 w-px origin-top bg-zinc-300"
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ delay: 0.3, duration: 0.3 }}
          />
        </div>
      )}

      <motion.div
        className="hidden h-px origin-center bg-zinc-300 xl:block"
        style={{ marginInline: "10%" }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.45, duration: 0.5, ease }}
      />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-5 xl:gap-4">
        {AREAS.map((a, i) => {
          const personas = equipo.filter((p) => p.area === a.id);
          return (
            <div key={a.id} className="flex flex-col items-stretch">
              <motion.div
                className="mx-auto hidden h-6 w-px origin-top bg-zinc-300 xl:block"
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: 0.6 + i * 0.05, duration: 0.25 }}
              />
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.07, duration: 0.45, ease }}
                className="mb-3 rounded-2xl bg-ink px-4 py-3 text-white"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">{a.nombre}<span className="text-accent">.</span></p>
                  <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold">{personas.length}</span>
                </div>
                <p className="mt-0.5 text-[11px] text-white/50">{a.descripcion}</p>
              </motion.div>
              <motion.div className="space-y-2" variants={contenedor} initial="hidden" animate="show">
                {personas.map((p) => (
                  <Tarjeta key={p.id} p={p} onSelect={setSel} />
                ))}
              </motion.div>
            </div>
          );
        })}
      </div>

      <AnimatePresence>{sel && <Panel key={sel.id} p={sel} onClose={() => setSel(null)} />}</AnimatePresence>
    </div>
  );
}

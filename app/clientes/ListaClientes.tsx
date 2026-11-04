"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Logo } from "@/components/Logo";
import { type Cliente, diasAlVencimiento, formatFecha, formatPago } from "@/lib/clientes";

export function ListaClientes({ clientes }: { clientes: Cliente[] }) {
  const [q, setQ] = useState("");
  const [pais, setPais] = useState("");
  const paises = useMemo(() => [...new Set(clientes.map((c) => c.pais).filter(Boolean))].sort() as string[], [clientes]);

  const lista = clientes
    .filter((c) => c.estado === "Activo")
    .filter((c) => !pais || c.pais === pais)
    .filter((c) => {
      const t = q.trim().toLowerCase();
      return !t || [c.nombre, c.instagram, c.contacto, ...c.rubros].some((v) => v?.toLowerCase().includes(t));
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return (
    <>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre, Instagram, contacto o rubro…"
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 sm:max-w-sm"
        />
        <select value={pais} onChange={(e) => setPais(e.target.value)} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm">
          <option value="">Todos los países</option>
          {paises.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <ul className="divide-y divide-zinc-100">
          {lista.map((c) => {
            const dias = diasAlVencimiento(c.vencimiento);
            const alerta = dias !== null && dias <= 7;
            return (
              <li key={c.id}>
                <Link href={`/clientes/${c.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-zinc-50">
                  <Logo cliente={c} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.nombre}</p>
                    <p className="truncate text-xs text-zinc-500">
                      {c.instagram ? `@${c.instagram}` : c.web ?? c.linkedin ?? "—"} · {c.pais}
                    </p>
                  </div>
                  <div className="hidden min-w-0 flex-1 flex-wrap gap-1 md:flex">
                    {c.planes.map((p) => (
                      <span key={p} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600">{p}</span>
                    ))}
                  </div>
                  <div className="hidden w-28 text-right text-sm tabular-nums sm:block">{formatPago(c.pagoMensual)}</div>
                  <div className={`w-24 text-right text-xs tabular-nums ${alerta ? "font-semibold text-red-600" : "text-zinc-500"}`}>
                    {formatFecha(c.vencimiento)}
                  </div>
                </Link>
              </li>
            );
          })}
          {!lista.length && <li className="px-4 py-8 text-center text-sm text-zinc-400">Sin resultados</li>}
        </ul>
      </div>
      <p className="mt-2 text-xs text-zinc-400">La fecha de la derecha es el vencimiento; en rojo si vence en 7 días o menos.</p>
    </>
  );
}

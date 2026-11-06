"use server";

import { revalidatePath } from "next/cache";
import { almacenConfigurado } from "@/lib/er/almacen";
import { FRECUENCIAS, followUpDe, guardarFollowUp } from "@/lib/followup";

function refrescar(id: string) {
  revalidatePath("/");
  revalidatePath("/clientes/dashboard");
  revalidatePath(`/clientes/${id}`);
}

const SIN_BASE = "Falta conectar la base Upstash Redis para guardar los follow ups.";

/** Define (o quita, con null) la frecuencia de follow up de un cliente. El contador arranca hoy. */
export async function definirFollowUp(id: string, cada: number | null) {
  if (!almacenConfigurado()) return { error: SIN_BASE };
  if (cada !== null && !FRECUENCIAS.some((f) => f.dias === cada)) return { error: "Frecuencia inválida." };
  const actual = await followUpDe(id);
  // Cambiar la frecuencia mantiene la fecha del último follow up.
  await guardarFollowUp(id, cada === null ? null : { cada, ultimo: actual?.ultimo ?? new Date().toISOString() });
  refrescar(id);
  return { ok: true };
}

/** Marca el follow up como hecho: borra la alerta y reinicia la cuenta desde hoy. */
export async function marcarRevisado(id: string) {
  if (!almacenConfigurado()) return { error: SIN_BASE };
  const actual = await followUpDe(id);
  if (!actual) return { error: "Este cliente no tiene follow up configurado." };
  await guardarFollowUp(id, { ...actual, ultimo: new Date().toISOString() });
  refrescar(id);
  return { ok: true };
}

/** Corrige la fecha del último follow up (por ejemplo, si se hizo antes de cargarlo en la plataforma). */
export async function registrarUltimo(id: string, fecha: string) {
  if (!almacenConfigurado()) return { error: SIN_BASE };
  const actual = await followUpDe(id);
  if (!actual) return { error: "Primero elegí cada cuánto hacer el follow up." };
  const d = new Date(fecha + "T12:00:00-03:00");
  if (isNaN(d.getTime()) || d.getTime() > Date.now()) return { error: "La fecha no puede ser futura." };
  await guardarFollowUp(id, { ...actual, ultimo: d.toISOString() });
  refrescar(id);
  return { ok: true };
}

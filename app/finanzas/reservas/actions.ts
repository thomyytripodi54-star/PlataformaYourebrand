"use server";

import { cookies } from "next/headers";
import { revalidatePath, revalidateTag } from "next/cache";
import { COOKIE, sesionValida } from "@/lib/auth";
import { almacenConfigurado } from "@/lib/er/almacen";
import { validarCarga } from "@/lib/reservas";
import { guardarReserva, TAG_RESERVAS } from "@/lib/reservas-almacen";

/** Carga o corrige la foto de reservas de un mes. */
export async function guardarMesReservas(datos: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await sesionValida((await cookies()).get(COOKIE)?.value))) return { ok: false, error: "Tu sesión venció. Volvé a ingresar." };
  if (!almacenConfigurado()) return { ok: false, error: "Falta conectar la base Upstash Redis para guardar las reservas." };
  const m = validarCarga(datos);
  if (typeof m === "string") return { ok: false, error: m };
  try {
    await guardarReserva(m);
  } catch (e) {
    console.error("[reservas] guardar:", e);
    return { ok: false, error: "No se pudo guardar. Probá de nuevo." };
  }
  revalidateTag(TAG_RESERVAS, { expire: 0 });
  revalidatePath("/finanzas");
  revalidatePath("/finanzas/reservas");
  return { ok: true };
}

"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, crearSesion, igualSeguro } from "@/lib/auth";

export async function login(_: string | null, form: FormData) {
  const usuario = String(form.get("usuario") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const U = process.env.AUTH_USER, P = process.env.AUTH_PASSWORD;
  if (!U || !P || !process.env.AUTH_SECRET) return "La plataforma no tiene configurado el acceso (faltan variables de entorno).";

  const ok = igualSeguro(usuario.toLowerCase(), U.toLowerCase()) && igualSeguro(password, P);
  if (!ok) {
    await new Promise((r) => setTimeout(r, 800));
    return "Usuario o contraseña incorrectos.";
  }
  const s = await crearSesion(usuario);
  (await cookies()).set(COOKIE, s.valor, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: s.maxAge });
  const next = String(form.get("next") ?? "/");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  (await cookies()).delete(COOKIE);
  redirect("/login");
}

"use client";

import { useActionState } from "react";
import { login } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [error, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="mt-10 space-y-3">
      <input type="hidden" name="next" value={next} />
      <input name="usuario" placeholder="Usuario" autoComplete="username" required className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm text-white placeholder-white/40 outline-none focus:bg-white/15" />
      <input name="password" type="password" placeholder="Contraseña" autoComplete="current-password" required className="w-full rounded-xl bg-white/10 px-4 py-3 text-sm text-white placeholder-white/40 outline-none focus:bg-white/15" />
      {error && <p className="text-sm text-white">{error}</p>}
      <button disabled={pending} className="w-full rounded-xl bg-accent py-3 text-sm font-bold text-white disabled:opacity-60">
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}

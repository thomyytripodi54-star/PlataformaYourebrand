import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, sesionValida } from "@/lib/auth";

export async function proxy(req: NextRequest) {
  if (await sesionValida(req.cookies.get(COOKIE)?.value)) return NextResponse.next();
  const url = new URL("/login", req.url);
  if (req.nextUrl.pathname !== "/") url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Todo requiere login salvo la pantalla de login y los archivos estáticos.
  matcher: ["/((?!login|api/notion-webhook|_next/static|_next/image|favicon.ico|logos/|geo/|maplibre/).*)"],
};

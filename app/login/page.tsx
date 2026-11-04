import { LoginForm } from "./LoginForm";

export const metadata = { title: "Ingresar · Yourebrand" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink px-4">
      <div className="w-full max-w-sm">
        <p className="text-4xl font-black tracking-tight text-white">
          Yourebrand<span className="text-accent">.</span>
        </p>
        <p className="mt-1 text-xs font-extralight text-white/70">Agencia Full service de marketing digital.</p>
        <LoginForm next={next ?? "/"} />
      </div>
    </div>
  );
}

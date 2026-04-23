import { Plus_Jakarta_Sans } from "next/font/google";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${plusJakartaSans.className} relative min-h-screen overflow-hidden bg-[#0A1628] text-white`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(245,166,35,0.18),transparent_40%),radial-gradient(circle_at_80%_90%,rgba(30,58,95,0.35),transparent_45%)]" />
      <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-300">
              Gestão completa para assessorias esportivas
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-white">
              Ventu <span className="text-[#F5A623]">Suli</span>
            </h1>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

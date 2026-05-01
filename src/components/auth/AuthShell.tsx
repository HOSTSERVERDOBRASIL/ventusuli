import Image from "next/image";
import { BarChart3, Trophy, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";

const featureHighlights = [
  {
    icon: BarChart3,
    title: "Dados claros",
    description: "Acompanhe sua evolucao com metricas simples.",
  },
  {
    icon: UsersRound,
    title: "Comunidade ativa",
    description: "Treine com gente que mantem o ritmo junto.",
  },
  {
    icon: Trophy,
    title: "Resultado real",
    description: "Metas, provas e progresso em um so lugar.",
  },
];

export function AuthShell({
  children,
  title,
  description,
  fitViewport = false,
}: {
  children: React.ReactNode;
  title: React.ReactNode;
  description: React.ReactNode;
  fitViewport?: boolean;
}) {
  return (
    <main
      className={cn(
        "relative min-h-svh overflow-x-hidden bg-[#020a1b] text-white",
        fitViewport && "lg:h-dvh lg:overflow-hidden",
      )}
    >
      <Image
        src="/auth/floripa-bridge-hero.webp"
        alt="Ponte Hercilio Luz em Florianopolis ao entardecer"
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,10,27,0.97)_0%,rgba(4,18,45,0.9)_45%,rgba(2,10,27,0.96)_100%)]" />

      <div
        className={cn(
          "relative z-10 grid min-h-svh items-center gap-7 px-5 py-6 md:px-10 lg:grid-cols-[minmax(0,1fr)_450px] lg:gap-10 lg:px-12 xl:px-16",
          fitViewport ? "lg:h-dvh lg:min-h-0 lg:py-5" : "lg:py-12",
        )}
      >
        <section className="mx-auto w-full max-w-[510px] text-center lg:mx-0 lg:text-left">
          <Image
            src="/auth/ventu-suli-floripa-logo.png"
            alt="Logo Ventu Suli Floripa"
            width={240}
            height={160}
            priority
            className="mx-auto h-auto w-36 object-contain lg:mx-0 lg:w-40"
          />

          <h1 className="mt-5 text-[34px] font-extrabold leading-[1.04] text-white sm:text-[42px] xl:text-[48px]">
            Transforme treinos em{" "}
            <span className="text-[#ffc229]">evolucao real.</span>
          </h1>

          <p className="mx-auto mt-3 max-w-[440px] text-[15px] leading-6 text-[#dce6f3] sm:text-base lg:mx-0">
            Disciplina, dados e comunidade para voce treinar melhor, competir com mais confianca e
            perceber o proprio progresso.
          </p>

          <div className="mx-auto mt-6 grid max-w-[470px] gap-2.5 lg:mx-0">
            {featureHighlights.map(({ icon: Icon, title: featureTitle, description: text }) => (
              <div
                key={featureTitle}
                className="grid grid-cols-[38px_minmax(0,1fr)] gap-3 rounded-xl border border-white/10 bg-white/[0.045] p-3 text-left"
              >
                <div className="grid h-[38px] w-[38px] place-items-center rounded-lg bg-[#ffc229]/12 text-[#ffc229]">
                  <Icon className="h-[18px] w-[18px]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold leading-5 text-white">{featureTitle}</p>
                  <p className="text-xs leading-5 text-slate-300">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto flex w-full max-w-[450px] items-center justify-center lg:mx-0">
          <div className="w-full rounded-[22px] border border-white/15 bg-[linear-gradient(180deg,rgba(4,12,31,0.95),rgba(5,13,29,0.9))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.42)] backdrop-blur-[18px] sm:p-7 lg:p-7">
            <div className="mb-4 lg:hidden">
              <Image
                src="/auth/ventu-suli-floripa-logo.png"
                alt="Logo Ventu Suli Floripa"
                width={180}
                height={120}
                className="h-auto w-28 object-contain"
              />
            </div>
            <div className="mb-5">
              <h2 className="text-[25px] font-extrabold leading-tight text-white sm:text-[28px]">
                {title}
              </h2>
              <p className="mt-1.5 text-sm leading-6 text-slate-300">{description}</p>
            </div>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}

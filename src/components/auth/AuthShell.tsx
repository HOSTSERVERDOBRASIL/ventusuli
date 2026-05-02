import Image from "next/image";
import { BarChart3, Trophy, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { VENTU_SULI_LOGO_SRC } from "@/lib/brand";

const featureHighlights = [
  {
    icon: BarChart3,
    title: "Dados claros",
    description: "Acompanhe sua evolução com métricas simples.",
  },
  {
    icon: UsersRound,
    title: "Comunidade ativa",
    description: "Treine com gente que mantém o ritmo junto.",
  },
  {
    icon: Trophy,
    title: "Resultado real",
    description: "Metas, provas e progresso em um só lugar.",
  },
];

export function AuthShell({
  children,
  title,
  description,
  fitViewport = false,
  logoScale = "default",
}: {
  children: React.ReactNode;
  title: React.ReactNode;
  description: React.ReactNode;
  fitViewport?: boolean;
  logoScale?: "default" | "hero";
}) {
  const isHeroLogo = logoScale === "hero";

  return (
    <div
      className={cn(
        "relative min-h-svh overflow-x-hidden bg-[#020a1b] text-white",
        fitViewport && "lg:min-h-dvh",
      )}
    >
      <header
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-20 px-5 pt-4 sm:px-6 lg:fixed lg:inset-x-auto lg:left-7 lg:top-5 lg:p-0",
          isHeroLogo && "lg:hidden",
        )}
      >
        <div className="mx-auto flex w-full max-w-[450px] justify-center lg:mx-0 lg:max-w-none lg:justify-start">
          <Image
            src={VENTU_SULI_LOGO_SRC}
            alt="Logo Ventu Suli Floripa"
            width={isHeroLogo ? 648 : 216}
            height={isHeroLogo ? 810 : 270}
            priority
            className={cn(
              "object-contain drop-shadow-[0_16px_28px_rgba(0,0,0,0.45)]",
              isHeroLogo
                ? "h-36 w-36 sm:h-44 sm:w-44"
                : "h-24 w-24 lg:h-16 lg:w-16 xl:h-[72px] xl:w-[72px]",
            )}
          />
        </div>
      </header>

      <Image
        src="/auth/floripa-bridge-hero.webp"
        alt="Ponte Hercilio Luz em Florianopolis ao entardecer"
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,10,27,0.97)_0%,rgba(4,18,45,0.9)_45%,rgba(2,10,27,0.96)_100%)]" />

      <main
        className={cn(
          "relative z-10 grid min-h-svh items-center gap-6 px-5 pb-6 pt-28 sm:px-6 md:px-10 lg:grid-cols-[minmax(0,1fr)_450px] lg:gap-10 lg:px-12 xl:px-16",
          fitViewport ? "lg:min-h-dvh lg:py-5" : "lg:py-12",
          isHeroLogo && "pt-48 sm:pt-60 lg:pt-5",
        )}
      >
        <section
          className={cn(
            "hidden w-full max-w-[510px] text-left lg:block",
            fitViewport && "lg:max-h-[calc(100dvh-40px)] lg:overflow-hidden",
          )}
        >
          {isHeroLogo ? (
            <Image
              src={VENTU_SULI_LOGO_SRC}
              alt="Logo Ventu Suli Floripa"
              width={1080}
              height={1350}
              priority
              className="-ml-8 mb-1 h-64 w-64 object-contain drop-shadow-[0_28px_60px_rgba(0,0,0,0.5)] xl:h-72 xl:w-72 2xl:h-[340px] 2xl:w-[340px]"
            />
          ) : null}

          <h1 className="text-[42px] font-extrabold leading-[1.04] text-white xl:text-[48px]">
            Transforme treinos em <span className="text-[#ffc229]">evolução real.</span>
          </h1>

          <p className="mt-3 max-w-[440px] text-base leading-6 text-[#dce6f3]">
            Disciplina, dados e comunidade para você treinar melhor, competir com mais confiança e
            perceber o próprio progresso.
          </p>

          <div className="mt-5 grid max-w-[470px] gap-2.5">
            {featureHighlights.map(({ icon: Icon, title: featureTitle, description: text }) => (
              <div
                key={featureTitle}
                className="grid grid-cols-[38px_minmax(0,1fr)] gap-3 rounded-lg border border-white/10 bg-white/[0.045] p-3 text-left"
              >
                <div className="grid h-[38px] w-[38px] place-items-center rounded-md bg-[#ffc229]/12 text-[#ffc229]">
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
          <div
            className={cn(
              "w-full rounded-lg border border-white/15 bg-[linear-gradient(180deg,rgba(4,12,31,0.95),rgba(5,13,29,0.9))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.42)] backdrop-blur-[18px] sm:p-7 lg:p-7",
              fitViewport && "lg:max-h-[calc(100dvh-40px)] lg:overflow-y-auto lg:p-6 xl:p-7",
            )}
          >
            <div className="mb-5">
              <h2 className="text-[25px] font-extrabold leading-tight text-white sm:text-[28px]">
                {title}
              </h2>
              <p className="mt-1.5 text-sm leading-6 text-slate-300">{description}</p>
            </div>
            {children}
          </div>
        </section>
      </main>
    </div>
  );
}

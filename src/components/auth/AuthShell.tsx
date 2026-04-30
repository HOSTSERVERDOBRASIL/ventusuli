import Image from "next/image";
import { BarChart3, MapPin, Quote, Trophy, UsersRound } from "lucide-react";

const featureHighlights = [
  {
    icon: BarChart3,
    title: "Dados que viram performance",
    description: "Acompanhe métricas que realmente importam.",
  },
  {
    icon: UsersRound,
    title: "Comunidade que impulsiona",
    description: "Conecte-se com atletas que te inspiram.",
  },
  {
    icon: Trophy,
    title: "Resultados que você mede",
    description: "Evolução clara, consistente e comprovada.",
  },
];

const locationCards = [
  {
    title: "Praia do Campeche",
    image: "/auth/beira-mar-card.png",
    objectPosition: "center center",
  },
  {
    title: "Beira-Mar Norte",
    image: "/auth/praia-campeche-card.webp",
    objectPosition: "center center",
  },
  {
    title: "Mercado Público",
    image: "/auth/mercado-publico-card.png",
    objectPosition: "center center",
  },
];

export function AuthShell({
  children,
  title,
  description,
}: {
  children: React.ReactNode;
  title: React.ReactNode;
  description: React.ReactNode;
}) {
  return (
    <main className="relative min-h-svh overflow-x-hidden bg-[#030817] text-white lg:h-svh lg:overflow-hidden">
      <Image
        src="/auth/floripa-bridge-hero.webp"
        alt="Ponte Hercílio Luz em Florianópolis ao entardecer"
        fill
        priority
        className="object-cover"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,8,23,0.92)_0%,rgba(2,8,23,0.58)_43%,rgba(2,8,23,0.28)_62%,rgba(2,8,23,0.88)_100%),linear-gradient(180deg,rgba(2,8,23,0.08)_0%,rgba(2,8,23,0.78)_100%)]" />

      <div className="relative z-10 flex min-h-svh px-5 py-5 sm:px-6 lg:h-svh lg:min-h-0 lg:px-8 lg:py-4 xl:px-12">
        <div className="mx-auto grid w-full max-w-[88rem] min-h-0 items-center gap-8 lg:grid-cols-[minmax(0,44rem)_minmax(26rem,32rem)] lg:justify-between xl:gap-14">
          <section className="hidden h-full min-w-0 flex-col justify-center overflow-hidden text-left lg:flex">
            <div className="w-full max-w-[44rem]">
              <div className="h-40 w-48 overflow-hidden">
                <Image
                  src="/auth/ventu-suli-logo.png"
                  alt="Logo Ventu Suli"
                  width={520}
                  height={520}
                  className="h-auto w-[23rem] max-w-none -translate-x-[6.2rem] -translate-y-[2.7rem]"
                />
              </div>

              <h1 className="mt-4 max-w-[13ch] text-[2.25rem] font-semibold leading-[1.04] text-white xl:text-[2.9rem]">
                Transforme treinos em <span className="text-[#f7b529]">evolução real.</span>
              </h1>
              <p className="mt-3 max-w-[30rem] text-base leading-7 text-slate-50/95">
                Conecte dados, disciplina e propósito para alcançar sua melhor versão.
              </p>

              <div className="mt-4 w-full max-w-[34rem] space-y-3">
                {featureHighlights.map(({ icon: Icon, title: featureTitle, description: text }) => (
                  <div key={featureTitle} className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/18 bg-[#071225]/72 text-[#f7b529] shadow-[0_12px_30px_rgba(0,0,0,0.24)] backdrop-blur-sm">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-base font-semibold leading-5 text-white">{featureTitle}</p>
                      <p className="mt-1 max-w-[27rem] text-sm leading-5 text-slate-100/90">{text}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 grid max-w-[34rem] grid-cols-[2rem_minmax(0,1fr)] gap-4 text-white">
                <Quote className="mt-0.5 h-8 w-8 shrink-0 fill-[#f7b529] text-[#f7b529]" />
                <p className="text-lg font-medium leading-snug xl:text-xl">
                  Disciplina constrói o que motivação{" "}
                  <span className="text-[#f7b529]">não sustenta.</span>
                </p>
              </div>

              <div className="mt-5 hidden w-full grid-cols-3 items-stretch gap-3 xl:grid">
                {locationCards.map((card) => (
                  <div
                    key={card.title}
                    className="relative aspect-[1.85] overflow-hidden rounded-lg border border-white/24 bg-black/30 shadow-[0_18px_44px_rgba(0,0,0,0.3)]"
                  >
                    <Image
                      src={card.image}
                      alt={card.title}
                      fill
                      sizes="18vw"
                      className="object-cover"
                      style={{ objectPosition: card.objectPosition }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/12 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 flex min-h-12 items-center gap-2 bg-black/56 px-4 py-3 backdrop-blur-[2px]">
                      <MapPin className="h-5 w-5 shrink-0 fill-[#f7b529] text-[#f7b529]" />
                      <span className="min-w-0 truncate text-sm font-semibold leading-5 text-white">
                        {card.title}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="flex min-h-[calc(100svh-2.5rem)] items-center justify-center lg:h-full lg:min-h-0 lg:justify-end lg:self-center">
            <div className="w-full max-w-[34rem]">
              <div className="rounded-[1.45rem] border border-white/25 bg-[linear-gradient(180deg,rgba(7,13,27,0.97),rgba(2,9,19,0.94))] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.58)] backdrop-blur-xl sm:rounded-[1.6rem] sm:p-6 lg:px-7 lg:py-5">
                <div className="mb-4 flex items-center gap-3 lg:hidden">
                  <div className="h-[4.5rem] w-20 shrink-0 overflow-hidden">
                    <Image
                      src="/auth/ventu-suli-logo.png"
                      alt="Logo Ventu Suli"
                      width={180}
                      height={180}
                      className="h-auto w-40 max-w-none -translate-x-[2.65rem] -translate-y-[1.2rem]"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xl font-semibold leading-tight text-white">Ventu Suli</p>
                    <p className="text-sm leading-5 text-slate-300">Performance e comunidade</p>
                  </div>
                </div>
                <div className="mb-4">
                  <h2 className="text-[1.65rem] font-semibold leading-tight text-white sm:text-[1.85rem]">
                    {title}
                  </h2>
                  <p className="mt-2 max-w-lg text-sm leading-6 text-slate-100 sm:text-base">
                    {description}
                  </p>
                </div>
                {children}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, UserCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { updateAthleteProfile } from "@/services/registrations-service";
import { isValidCpf, normalizeCpf } from "@/lib/cpf";

export default function OnboardingAtletaPage() {
  const router = useRouter();
  const { accessToken, currentUser, hasCpf, hydrated } = useAuthToken();

  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [stateUf, setStateUf] = useState("");
  const [sportLevel, setSportLevel] = useState("BEGINNER");
  const [sportGoal, setSportGoal] = useState("Correr minha primeira prova de 5K");
  const [nextCompetitionDate, setNextCompetitionDate] = useState("");
  const [cpfError, setCpfError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // If athlete already has CPF (e.g., navigated here directly), skip onboarding.
  useEffect(() => {
    if (!hydrated) return;
    if (hasCpf === true) {
      router.replace("/");
    }
  }, [hydrated, hasCpf, router]);

  function handleCpfChange(raw: string) {
    const digits = normalizeCpf(raw);
    let formatted = digits;
    if (digits.length > 9)
      formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
    else if (digits.length > 6)
      formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    else if (digits.length > 3)
      formatted = `${digits.slice(0, 3)}.${digits.slice(3)}`;

    setCpf(formatted);

    if (digits.length === 11) {
      setCpfError(isValidCpf(digits) ? null : "CPF inválido. Verifique os dígitos.");
    } else {
      setCpfError(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const digits = normalizeCpf(cpf);
    if (!digits) {
      setCpfError("CPF obrigatório.");
      return;
    }
    if (!isValidCpf(digits)) {
      setCpfError("CPF inválido. Verifique os dígitos.");
      return;
    }

    setSaving(true);
    try {
      await updateAthleteProfile(
        {
          cpf: digits,
          city: city.trim(),
          state: stateUf.trim().toUpperCase(),
          sport_level: sportLevel as "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "ELITE",
          sport_goal: sportGoal.trim() || null,
          next_competition_date: nextCompetitionDate || null,
          ...(phone.trim() ? { phone: phone.trim() } : {}),
        },
        accessToken,
      );

      setDone(true);
      toast.success("Perfil completado! Bem-vindo ao Ventu Suli.");

      // Small delay so the success animation is visible.
      setTimeout(() => {
        router.replace("/");
      }, 1400);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar perfil.");
    } finally {
      setSaving(false);
    }
  }

  if (!hydrated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#8eb0dc]" />
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="success-pop rounded-2xl border border-emerald-300/40 bg-emerald-500/10 px-10 py-10 text-center text-emerald-100">
          <CheckCircle2 className="mx-auto mb-3 h-16 w-16 text-emerald-300" />
          <h2 className="text-2xl font-bold text-emerald-200">Tudo pronto!</h2>
          <p className="mt-1 text-sm text-emerald-100/80">Redirecionando para o dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-10 text-white">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[#2f5d8f] bg-[#0f233d]">
          <UserCircle2 className="h-9 w-9 text-[#38bdf8]" />
        </div>
        <h1 className="text-2xl font-bold text-white">
          Bem-vindo{currentUser?.name ? `, ${currentUser.name.split(" ")[0]}` : ""}!
        </h1>
        <p className="mt-2 text-sm text-[#8eb0dc]">
          Para recomendar provas, treinos e metas melhores, precisamos do seu CPF,
          cidade, UF e objetivo de corrida.
          <br />
          Leva menos de 30 segundos.
        </p>
      </div>

      {/* Why CPF */}
      <div className="rounded-xl border border-[#24486f] bg-[#0a1d36] p-4 text-sm text-[#8eb0dc]">
        <p className="mb-2 font-semibold text-[#c4d8f6]">Por que pedimos seu CPF?</p>
        <ul className="list-inside list-disc space-y-1">
          <li>Emissão de cobrança PIX</li>
          <li>Confirmação de inscrição na prova</li>
          <li>Identificação no kit e na largada</li>
        </ul>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {[
          { title: "Pagamento", text: "CPF libera inscricao e cobranca PIX." },
          { title: "Prova certa", text: "Nivel e objetivo calibram as recomendacoes." },
          { title: "Seguranca", text: "Cidade e contato ajudam a assessoria na operacao." },
        ].map((item) => (
          <div key={item.title} className="rounded-xl border border-[#24486f] bg-[#0a1d36] p-4">
            <p className="text-sm font-semibold text-[#c4d8f6]">{item.title}</p>
            <p className="mt-2 text-xs leading-5 text-[#8eb0dc]">{item.text}</p>
          </div>
        ))}
      </div>

      {/* Form */}
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-[#8eb0dc]">
            CPF <span className="text-amber-400">*</span>
          </label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="000.000.000-00"
            maxLength={14}
            value={cpf}
            onChange={(e) => handleCpfChange(e.target.value)}
            className="w-full rounded-xl border border-[#24486f] bg-[#0f233d] px-4 py-3 text-base text-white placeholder:text-[#4a7fa8] focus:outline-none focus:ring-2 focus:ring-[#3a8fd4]"
          />
          {cpfError ? (
            <p className="mt-1.5 text-xs text-red-400">{cpfError}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-[#8eb0dc]">
            Telefone <span className="text-[#4a7fa8]">(opcional)</span>
          </label>
          <input
            type="tel"
            placeholder="(11) 99999-9999"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-xl border border-[#24486f] bg-[#0f233d] px-4 py-3 text-base text-white placeholder:text-[#4a7fa8] focus:outline-none focus:ring-2 focus:ring-[#3a8fd4]"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-[#8eb0dc]">
              Cidade <span className="text-amber-400">*</span>
            </label>
            <input
              type="text"
              placeholder="Sua cidade"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-xl border border-[#24486f] bg-[#0f233d] px-4 py-3 text-base text-white placeholder:text-[#4a7fa8] focus:outline-none focus:ring-2 focus:ring-[#3a8fd4]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-[#8eb0dc]">
              UF <span className="text-amber-400">*</span>
            </label>
            <input
              type="text"
              placeholder="SP"
              value={stateUf}
              maxLength={2}
              onChange={(e) => setStateUf(e.target.value.toUpperCase())}
              className="w-full rounded-xl border border-[#24486f] bg-[#0f233d] px-4 py-3 text-base text-white placeholder:text-[#4a7fa8] focus:outline-none focus:ring-2 focus:ring-[#3a8fd4]"
            />
          </div>
        </div>

        <div className="rounded-xl border border-[#24486f] bg-[#0a1d36] p-4">
          <p className="mb-3 text-xs uppercase tracking-wide text-[#8eb0dc]">
            Objetivo de corrida
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-[#8eb0dc]">
                Nivel atual
              </label>
              <select
                value={sportLevel}
                onChange={(e) => setSportLevel(e.target.value)}
                className="w-full rounded-xl border border-[#24486f] bg-[#0f233d] px-4 py-3 text-base text-white focus:outline-none focus:ring-2 focus:ring-[#3a8fd4]"
              >
                <option value="BEGINNER">Iniciante</option>
                <option value="INTERMEDIATE">Intermediario</option>
                <option value="ADVANCED">Avancado</option>
                <option value="ELITE">Performance</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wide text-[#8eb0dc]">
                Proxima prova alvo
              </label>
              <input
                type="date"
                value={nextCompetitionDate}
                onChange={(e) => setNextCompetitionDate(e.target.value)}
                className="w-full rounded-xl border border-[#24486f] bg-[#0f233d] px-4 py-3 text-base text-white focus:outline-none focus:ring-2 focus:ring-[#3a8fd4]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs uppercase tracking-wide text-[#8eb0dc]">
                Meta principal
              </label>
              <select
                value={sportGoal}
                onChange={(e) => setSportGoal(e.target.value)}
                className="w-full rounded-xl border border-[#24486f] bg-[#0f233d] px-4 py-3 text-base text-white focus:outline-none focus:ring-2 focus:ring-[#3a8fd4]"
              >
                <option value="Correr minha primeira prova de 5K">Primeira prova de 5K</option>
                <option value="Evoluir para 10K com seguranca">Evoluir para 10K</option>
                <option value="Preparar minha primeira meia maratona 21K">
                  Primeira meia maratona
                </option>
                <option value="Preparar maratona 42K">Maratona 42K</option>
                <option value="Melhorar pace e buscar recorde pessoal">Melhorar pace / RP</option>
                <option value="Correr por saude e consistencia">Saude e consistencia</option>
              </select>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={
            saving ||
            Boolean(cpfError) ||
            normalizeCpf(cpf).length < 11 ||
            city.trim().length < 2 ||
            stateUf.trim().length !== 2
          }
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#F5A623] py-3 text-base font-semibold text-[#0A1628] transition hover:bg-[#e59a1f] disabled:opacity-50"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            "Concluir e entrar"
          )}
        </button>

        <p className="text-center text-xs text-[#4a7fa8]">
          Você pode completar os demais dados depois em{" "}
          <a href="/perfil" className="text-[#8eb0dc] underline hover:text-white">
            Meu Perfil
          </a>
          .
        </p>
      </form>
    </div>
  );
}

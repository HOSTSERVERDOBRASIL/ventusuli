"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ACCEPTED_IMAGE_FILE_INPUT_ACCEPT,
  uploadImageFile,
} from "@/services/upload-service";
import { UserRole } from "@/types";

type PlanOption = "FREE" | "STARTER" | "PRO" | "ENTERPRISE";

interface SetupFormState {
  name: string;
  slug: string;
  plan: PlanOption;
  supportEmail: string;
  primaryColor: string;
  logoUrl: string;
  allowAthleteSelfSignup: boolean;
  requireAthleteApproval: boolean;
  defaultCity: string;
  defaultState: string;
  notes: string;
}

function parseSettingsValue<T>(settings: unknown, ...keys: string[]): T | undefined {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return undefined;
  let current: unknown = settings;
  for (const key of keys) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current as T;
}

const PLAN_LABEL: Record<PlanOption, string> = {
  FREE: "Free",
  STARTER: "Starter",
  PRO: "Pro",
  ENTERPRISE: "Enterprise",
};

export default function OrganizationSetupOnboardingPage() {
  const router = useRouter();
  const { accessToken, currentUser, organization, refreshSession } = useAuthToken();
  const [submitting, setSubmitting] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<SetupFormState>({
    name: "",
    slug: "",
    plan: "FREE",
    supportEmail: "",
    primaryColor: "#F5A623",
    logoUrl: "",
    allowAthleteSelfSignup: false,
    requireAthleteApproval: true,
    defaultCity: "",
    defaultState: "",
    notes: "",
  });

  const isAdmin = currentUser?.role === UserRole.ADMIN;

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";
    if (!selectedFile) return;

    setUploadingLogo(true);
    try {
      const uploaded = await uploadImageFile(selectedFile, "branding", accessToken);
      setForm((prev) => ({ ...prev, logoUrl: uploaded.url }));
      toast.success("Logo enviada. Ela sera aplicada ao concluir o setup.");
    } catch (uploadError) {
      toast.error(uploadError instanceof Error ? uploadError.message : "Falha ao enviar logo.");
    } finally {
      setUploadingLogo(false);
    }
  };

  useEffect(() => {
    if (!organization) return;

    setForm((prev) => ({
      ...prev,
      name: organization.name ?? "",
      slug: organization.slug ?? "",
      plan: organization.plan ?? "FREE",
      supportEmail:
        parseSettingsValue<string>(organization.settings, "branding", "supportEmail") ?? "",
      primaryColor:
        parseSettingsValue<string>(organization.settings, "branding", "primaryColor") ?? "#F5A623",
      logoUrl: organization.logo_url ?? "",
      allowAthleteSelfSignup:
        parseSettingsValue<boolean>(organization.settings, "allowAthleteSelfSignup") ?? false,
      requireAthleteApproval:
        parseSettingsValue<boolean>(organization.settings, "requireAthleteApproval") ?? true,
      defaultCity:
        parseSettingsValue<string>(organization.settings, "initialData", "defaultCity") ?? "",
      defaultState:
        parseSettingsValue<string>(organization.settings, "initialData", "defaultState") ?? "",
      notes: parseSettingsValue<string>(organization.settings, "initialData", "notes") ?? "",
    }));
  }, [organization]);

  const statusLabel = useMemo(() => {
    const status = organization?.status ?? "PENDING_SETUP";
    if (status === "PENDING_SETUP") return "Pendente de setup inicial";
    if (status === "ACTIVE") return "Ativa";
    if (status === "TRIAL") return "Trial";
    if (status === "SUSPENDED") return "Suspensa";
    return "Cancelada";
  }, [organization?.status]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/organization/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          plan: form.plan,
          branding: {
            supportEmail: form.supportEmail || undefined,
            primaryColor: form.primaryColor || undefined,
            logoUrl: form.logoUrl || null,
          },
          athletePolicy: {
            allowAthleteSelfSignup: form.allowAthleteSelfSignup,
            requireAthleteApproval: form.requireAthleteApproval,
          },
          initialData: {
            defaultCity: form.defaultCity || undefined,
            defaultState: form.defaultState || undefined,
            notes: form.notes || undefined,
          },
        }),
      });

      const payload = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        const message =
          payload.error?.message ?? "Nao foi possivel concluir o setup da assessoria.";
        setError(message);
        toast.error(message);
        return;
      }

      await refreshSession();
      toast.success("Setup inicial concluido com sucesso.");
      router.push("/admin");
    } catch {
      const message = "Falha de conexao ao concluir setup.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentUser || !organization) {
    return (
      <main className="p-6">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#102D4B]/70 px-4 py-3 text-slate-200">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando contexto da assessoria...
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="p-6">
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
          Apenas administradores podem concluir o setup inicial da assessoria.
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6 p-6">
      <section className="rounded-2xl border border-[#315d8f]/40 bg-[#102D4B]/90 p-6">
        <h1 className="text-2xl font-semibold text-white">Setup inicial da assessoria</h1>
        <p className="mt-2 text-sm text-slate-300">
          Conclua os dados principais para ativar a operacao da sua assessoria na plataforma.
        </p>
        <div className="mt-3 inline-flex items-center rounded-md border border-white/15 bg-[#0F2743] px-3 py-1 text-xs text-slate-200">
          Status atual: <span className="ml-1 font-semibold text-white">{statusLabel}</span>
        </div>
      </section>

      <section className="rounded-2xl border border-[#315d8f]/40 bg-[#102D4B]/80 p-5">
        <form onSubmit={onSubmit} className="space-y-6">
          {error ? (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-slate-100" htmlFor="name">
                Nome da assessoria
              </Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className="border-white/15 bg-[#0F2743] text-white"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-100" htmlFor="slug">
                Slug publico
              </Label>
              <Input
                id="slug"
                value={form.slug}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, slug: e.target.value.toLowerCase().trim() }))
                }
                className="border-white/15 bg-[#0F2743] text-white"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-100" htmlFor="plan">
                Plano
              </Label>
              <select
                id="plan"
                value={form.plan}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, plan: e.target.value as PlanOption }))
                }
                className="h-10 w-full rounded-md border border-white/15 bg-[#0F2743] px-3 text-sm text-white"
              >
                {(["FREE", "STARTER", "PRO", "ENTERPRISE"] as PlanOption[]).map((plan) => (
                  <option key={plan} value={plan}>
                    {PLAN_LABEL[plan]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-100" htmlFor="supportEmail">
                Email de suporte
              </Label>
              <Input
                id="supportEmail"
                type="email"
                value={form.supportEmail}
                onChange={(e) => setForm((prev) => ({ ...prev, supportEmail: e.target.value }))}
                className="border-white/15 bg-[#0F2743] text-white"
                placeholder="suporte@suaassessoria.com"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-100" htmlFor="primaryColor">
                Cor primaria
              </Label>
              <Input
                id="primaryColor"
                value={form.primaryColor}
                onChange={(e) => setForm((prev) => ({ ...prev, primaryColor: e.target.value }))}
                className="border-white/15 bg-[#0F2743] text-white"
                placeholder="#F5A623"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="text-slate-100" htmlFor="logoUrl">
                Logo da assessoria
              </Label>
              <div className="grid gap-3 rounded-xl border border-white/10 bg-[#0F2743] p-3 md:grid-cols-[104px_1fr]">
                <div className="flex h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-xl border border-white/20 bg-[#0a1d36]">
                  {form.logoUrl ? (
                    <img
                      src={form.logoUrl}
                      alt="Preview da logo da assessoria"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-slate-400">Sem logo</span>
                  )}
                </div>
                <div className="space-y-2">
                  <Input
                    id="logoUrl"
                    value={form.logoUrl}
                    onChange={(e) => setForm((prev) => ({ ...prev, logoUrl: e.target.value }))}
                    className="border-white/15 bg-[#0a1d36] text-white"
                    placeholder="https://cdn.seudominio.com/logo.png"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center rounded-lg border border-[#2f5d8f] bg-[#0a1d36] px-3 py-2 text-xs font-medium text-[#c8dbf8] transition hover:border-[#4f7fb4]">
                      <input
                        type="file"
                        accept={ACCEPTED_IMAGE_FILE_INPUT_ACCEPT}
                        className="hidden"
                        onChange={(event) => void handleLogoUpload(event)}
                        disabled={uploadingLogo}
                      />
                      {uploadingLogo ? "Carregando..." : "Fazer upload da logo"}
                    </label>
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, logoUrl: "" }))}
                      className="rounded-lg border border-white/15 bg-[#0a1d36] px-3 py-2 text-xs font-medium text-slate-300 transition hover:text-white"
                      disabled={uploadingLogo}
                    >
                      Remover logo
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    PNG, JPG, WEBP ou GIF com ate 2MB.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-100" htmlFor="defaultCity">
                Cidade padrao
              </Label>
              <Input
                id="defaultCity"
                value={form.defaultCity}
                onChange={(e) => setForm((prev) => ({ ...prev, defaultCity: e.target.value }))}
                className="border-white/15 bg-[#0F2743] text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-100" htmlFor="defaultState">
                UF padrao
              </Label>
              <Input
                id="defaultState"
                value={form.defaultState}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, defaultState: e.target.value.toUpperCase() }))
                }
                className="border-white/15 bg-[#0F2743] text-white"
                maxLength={2}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-100" htmlFor="notes">
              Dados iniciais e observacoes
            </Label>
            <textarea
              id="notes"
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              className="min-h-[96px] w-full rounded-md border border-white/15 bg-[#0F2743] px-3 py-2 text-sm text-white outline-none"
              placeholder="Ex: foco em corrida de rua, equipe principal, regras internas..."
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0F2743] px-3 py-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={form.allowAthleteSelfSignup}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, allowAthleteSelfSignup: e.target.checked }))
                }
                className="h-4 w-4 accent-[#F5A623]"
              />
              Permitir auto cadastro por slug
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0F2743] px-3 py-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={form.requireAthleteApproval}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, requireAthleteApproval: e.target.checked }))
                }
                className="h-4 w-4 accent-[#F5A623]"
              />
              Exigir aprovacao de atletas
            </label>
          </div>

          <div className="flex items-center justify-end">
            <Button
              type="submit"
              disabled={submitting}
              className="h-11 bg-[#F5A623] px-6 font-semibold text-[#0A1628] hover:bg-[#e59a1f]"
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando setup...
                </span>
              ) : (
                "Concluir setup inicial"
              )}
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}

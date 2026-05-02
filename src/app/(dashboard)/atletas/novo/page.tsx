"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { ActionButton } from "@/components/system/action-button";
import { EmptyState } from "@/components/system/empty-state";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createAthleteByAdmin } from "@/services/athletes-service";
import { UserRole } from "@/types";

const FULL_REQUIRED_FIELDS = ["cpf", "phone", "city", "state"] as const;

type FormState = {
  name: string;
  email: string;
  cpf: string;
  phone: string;
  city: string;
  state: string;
  birthDate: string;
  gender: string;
  emergencyContact: string;
};

const INITIAL_FORM: FormState = {
  name: "",
  email: "",
  cpf: "",
  phone: "",
  city: "",
  state: "",
  birthDate: "",
  gender: "",
  emergencyContact: "",
};

export default function NovoAtletaPage() {
  const router = useRouter();
  const { accessToken, userRoles } = useAuthToken();

  const [mode, setMode] = useState<"QUICK" | "FULL">("QUICK");
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{
    name: string;
    email: string;
    temporaryPassword: string;
  } | null>(null);

  const canManage = userRoles.includes(UserRole.ADMIN) || userRoles.includes(UserRole.MANAGER);

  const isValid = useMemo(() => {
    if (!form.name.trim() || !form.email.trim()) return false;
    if (mode === "FULL") {
      return FULL_REQUIRED_FIELDS.every((field) => Boolean(form[field].trim()));
    }
    return true;
  }, [form, mode]);

  if (!canManage) {
    return (
      <EmptyState
        title="Acesso restrito"
        description="Somente admin da assessoria pode cadastrar atletas."
      />
    );
  }

  return (
    <div className="space-y-6 text-white">
      <PageHeader
        title="Novo atleta"
        subtitle="Cadastre atletas vinculados à sua assessoria em modo rápido ou completo."
        actions={
          <ActionButton asChild intent="secondary">
            <Link href="/admin/atletas">
              <Users className="mr-2 h-4 w-4" />
              Voltar para atletas
            </Link>
          </ActionButton>
        }
      />

      <SectionCard
        title="Modo de cadastro"
        description="Escolha entre pré-cadastro rápido e cadastro completo"
      >
        <div className="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            className={
              mode === "QUICK"
                ? "rounded-xl border border-[#F5A623]/60 bg-[#13304f] px-4 py-3 text-left"
                : "rounded-xl border border-white/15 bg-[#0F2743] px-4 py-3 text-left hover:border-white/30"
            }
            onClick={() => setMode("QUICK")}
          >
            <p className="text-sm font-semibold text-white">Pré-cadastro rápido</p>
            <p className="mt-1 text-xs text-slate-300">
              Apenas nome e email para inserir atleta rapidamente.
            </p>
          </button>

          <button
            type="button"
            className={
              mode === "FULL"
                ? "rounded-xl border border-[#F5A623]/60 bg-[#13304f] px-4 py-3 text-left"
                : "rounded-xl border border-white/15 bg-[#0F2743] px-4 py-3 text-left hover:border-white/30"
            }
            onClick={() => setMode("FULL")}
          >
            <p className="text-sm font-semibold text-white">Cadastro completo</p>
            <p className="mt-1 text-xs text-slate-300">
              Inclui dados de perfil para operação esportiva e financeira.
            </p>
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Dados do atleta" description="Informações obrigatórias e complementares">
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!isValid || submitting) return;

            setSubmitting(true);
            try {
              const payload = await createAthleteByAdmin(
                {
                  mode,
                  name: form.name.trim(),
                  email: form.email.trim(),
                  cpf: form.cpf.trim() || undefined,
                  phone: form.phone.trim() || undefined,
                  city: form.city.trim() || undefined,
                  state: form.state.trim() || undefined,
                  birthDate: form.birthDate || undefined,
                  gender: form.gender.trim() || undefined,
                  emergencyContact: form.emergencyContact.trim() || undefined,
                },
                accessToken,
              );

              setCreated({
                name: payload.data.name,
                email: payload.data.email,
                temporaryPassword: payload.data.temporaryPassword,
              });

              toast.success("Atleta cadastrado com sucesso.");
              setForm(INITIAL_FORM);
              setMode("QUICK");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Falha ao cadastrar atleta.");
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                className="border-white/15 bg-[#0F2743] text-white"
                placeholder="Nome completo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                className="border-white/15 bg-[#0F2743] text-white"
                placeholder="atleta@email.com"
              />
            </div>
          </div>

          {mode === "FULL" ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF *</Label>
                <Input
                  id="cpf"
                  value={form.cpf}
                  onChange={(event) => setForm((prev) => ({ ...prev, cpf: event.target.value }))}
                  className="border-white/15 bg-[#0F2743] text-white"
                  placeholder="00000000000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefone *</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                  className="border-white/15 bg-[#0F2743] text-white"
                  placeholder="(48) 99999-9999"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">Cidade *</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
                  className="border-white/15 bg-[#0F2743] text-white"
                  placeholder="Florianopolis"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">Estado (UF) *</Label>
                <Input
                  id="state"
                  value={form.state}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, state: event.target.value.toUpperCase() }))
                  }
                  className="border-white/15 bg-[#0F2743] text-white"
                  placeholder="SC"
                  maxLength={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="birthDate">Data de nascimento (opcional)</Label>
                <Input
                  id="birthDate"
                  type="date"
                  value={form.birthDate}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, birthDate: event.target.value }))
                  }
                  className="border-white/15 bg-[#0F2743] text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gender">Genero (opcional)</Label>
                <Select
                  id="gender"
                  value={form.gender}
                  onChange={(event) => setForm((prev) => ({ ...prev, gender: event.target.value }))}
                  className="border-white/15 bg-[#0F2743] text-white"
                >
                  <option value="">Não informado</option>
                  <option value="F">Feminino</option>
                  <option value="M">Masculino</option>
                  <option value="NB">Não-binário</option>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="emergencyContact">Contato de emergencia (opcional)</Label>
                <Input
                  id="emergencyContact"
                  value={form.emergencyContact}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, emergencyContact: event.target.value }))
                  }
                  className="border-white/15 bg-[#0F2743] text-white"
                  placeholder="Nome e telefone"
                />
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-300">
              No pré-cadastro rápido, o perfil será criado com dados mínimos e pode ser
              complementado depois.
            </p>
          )}

          <div className="flex items-center gap-2">
            <ActionButton type="submit" disabled={!isValid || submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Cadastrar atleta
                </>
              )}
            </ActionButton>

            <ActionButton
              type="button"
              intent="secondary"
              onClick={() => {
                setForm(INITIAL_FORM);
                setMode("QUICK");
              }}
              disabled={submitting}
            >
              Limpar
            </ActionButton>
          </div>
        </form>
      </SectionCard>

      {created ? (
        <SectionCard
          title="Atleta criado"
          description="Compartilhe a senha temporaria com seguranca"
        >
          <div className="space-y-2 rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-sm">
            <p>
              <span className="font-semibold">Nome:</span> {created.name}
            </p>
            <p>
              <span className="font-semibold">Email:</span> {created.email}
            </p>
            <p>
              <span className="font-semibold">Senha temporaria:</span> {created.temporaryPassword}
            </p>
            <p className="text-xs text-emerald-200">
              Oriente o atleta a trocar a senha no primeiro acesso.
            </p>
          </div>

          <div className="mt-3 flex gap-2">
            <ActionButton asChild intent="secondary" size="sm">
              <Link href="/admin/atletas">Voltar para lista</Link>
            </ActionButton>
            <ActionButton
              size="sm"
              onClick={() => router.push(`/admin/atletas?q=${encodeURIComponent(created.email)}`)}
            >
              Ver na listagem
            </ActionButton>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}

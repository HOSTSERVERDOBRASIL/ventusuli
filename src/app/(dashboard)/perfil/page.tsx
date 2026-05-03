"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, CircleUserRound, Copy, Mail, Pencil, ShieldCheck, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { getAthleteIdentity, updateAthleteProfile } from "@/services/registrations-service";
import { AthleteIdentity } from "@/services/types";
import { createInvite, listInvites, OrgInvite } from "@/services/organization-service";
import { formatCpf, isValidCpf, normalizeCpf } from "@/lib/cpf";
import { uploadImageFile } from "@/services/upload-service";
import { roleLabel as formatRoleLabel } from "@/lib/role-labels";

const BRAZILIAN_STATES = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

const GENDER_LABELS: Record<string, string> = { M: "Masculino", F: "Feminino", O: "Outro" };
const SPORT_LEVEL_LABELS: Record<string, string> = {
  BEGINNER: "Iniciante",
  INTERMEDIATE: "Intermediario",
  ADVANCED: "Avancado",
  ELITE: "Performance",
};

interface FormState {
  cpf: string;
  phone: string;
  city: string;
  state: string;
  birth_date: string;
  gender: string;
  sport_level: string;
  sport_goal: string;
  next_competition_date: string;
  ec_name: string;
  ec_phone: string;
  ec_relation: string;
}

function toFormState(identity: AthleteIdentity): FormState {
  return {
    cpf: identity.cpf ? formatCpf(identity.cpf) : "",
    phone: identity.phone ?? "",
    city: identity.city ?? "",
    state: identity.state ?? "",
    birth_date: identity.birthDate ? identity.birthDate.slice(0, 10) : "",
    gender: identity.gender ?? "",
    sport_level: identity.sportLevel ?? "",
    sport_goal: identity.sportGoal ?? "",
    next_competition_date: identity.nextCompetitionDate
      ? identity.nextCompetitionDate.slice(0, 10)
      : "",
    ec_name: identity.emergencyContact?.name ?? "",
    ec_phone: identity.emergencyContact?.phone ?? "",
    ec_relation: identity.emergencyContact?.relation ?? "",
  };
}

function inputClass(extra = "") {
  return [
    "w-full rounded-xl border border-[#24486f] bg-[#0f233d] px-3 py-2",
    "text-sm text-white placeholder:text-[#4a7fa8]",
    "focus:outline-none focus:ring-2 focus:ring-[#3a8fd4]",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

function labelClass() {
  return "block text-xs uppercase tracking-wide text-[#8eb0dc] mb-1";
}

function initialsFromName(name?: string | null): string {
  if (!name?.trim()) return "A";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function PerfilPage() {
  const { accessToken, userRole, organization, currentUser, refreshSession } = useAuthToken();
  const [identity, setIdentity] = useState<AthleteIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [friendInvites, setFriendInvites] = useState<OrgInvite[]>([]);
  const [friendInviteLoading, setFriendInviteLoading] = useState(false);
  const [friendInviteCreating, setFriendInviteCreating] = useState(false);
  const [friendName, setFriendName] = useState("");
  const [friendEmail, setFriendEmail] = useState("");
  const [form, setForm] = useState<FormState>({
    cpf: "",
    phone: "",
    city: "",
    state: "",
    birth_date: "",
    gender: "",
    sport_level: "",
    sport_goal: "",
    next_competition_date: "",
    ec_name: "",
    ec_phone: "",
    ec_relation: "",
  });
  const [cpfError, setCpfError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getAthleteIdentity(accessToken);
        if (!cancelled) {
          setIdentity(data);
          setForm(toFormState(data));
        }
      } catch {
        if (!cancelled) setError("Não foi possível carregar os dados do perfil.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, reloadKey]);

  useEffect(() => {
    if (organization?.name || !userRole) return;
    void refreshSession();
  }, [organization?.name, refreshSession, userRole]);

  const isAthleteRole = userRole === "ATHLETE" || !userRole;
  const roleLabel = formatRoleLabel(userRole);
  const organizationName =
    organization?.name ?? currentUser?.organization?.name ?? "Assessoria nao identificada";

  const hasCpf = Boolean(identity?.cpf);

  useEffect(() => {
    if (userRole !== "ATHLETE") return;

    let cancelled = false;

    const loadInvites = async () => {
      setFriendInviteLoading(true);
      try {
        const data = await listInvites(accessToken);
        if (!cancelled) setFriendInvites(data);
      } catch {
        if (!cancelled) setFriendInvites([]);
      } finally {
        if (!cancelled) setFriendInviteLoading(false);
      }
    };

    void loadInvites();
    return () => {
      cancelled = true;
    };
  }, [accessToken, userRole]);

  function handleCpfChange(raw: string) {
    // Auto-format as user types: insert dots and dash
    const digits = normalizeCpf(raw);
    let formatted = digits;
    if (digits.length > 9)
      formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
    else if (digits.length > 6)
      formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    else if (digits.length > 3) formatted = `${digits.slice(0, 3)}.${digits.slice(3)}`;

    setForm((f) => ({ ...f, cpf: formatted }));

    if (digits.length === 11) {
      setCpfError(isValidCpf(digits) ? null : "CPF inválido. Verifique os dígitos.");
    } else {
      setCpfError(null);
    }
  }

  async function handleSave() {
    if (!form.cpf && identity?.cpf) {
      toast.error("CPF não pode ser removido após cadastro.");
      return;
    }

    const cpfDigits = normalizeCpf(form.cpf);
    if (cpfDigits && !isValidCpf(cpfDigits)) {
      setCpfError("CPF inválido. Verifique os dígitos.");
      return;
    }

    setSaving(true);
    try {
      const hasEc = form.ec_name.trim() || form.ec_phone.trim();

      await updateAthleteProfile(
        {
          ...(cpfDigits ? { cpf: cpfDigits } : {}),
          phone: form.phone.trim() || null,
          city: form.city.trim() || null,
          state: form.state || null,
          birth_date: form.birth_date || null,
          gender: form.gender || null,
          sport_level: form.sport_level
            ? (form.sport_level as "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "ELITE")
            : null,
          sport_goal: form.sport_goal.trim() || null,
          next_competition_date: form.next_competition_date || null,
          emergency_contact: hasEc
            ? {
                name: form.ec_name.trim(),
                phone: form.ec_phone.trim(),
                ...(form.ec_relation.trim() ? { relation: form.ec_relation.trim() } : {}),
              }
            : null,
        },
        accessToken,
      );

      const updated = await getAthleteIdentity(accessToken);
      setIdentity(updated);
      setForm(toFormState(updated));
      setEditing(false);
      toast.success("Perfil atualizado com sucesso!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar perfil.");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    if (identity) setForm(toFormState(identity));
    setCpfError(null);
    setEditing(false);
  }

  async function handleAvatarUpload(file: File) {
    setAvatarUploading(true);
    try {
      const uploaded = await uploadImageFile(file, "avatars", accessToken);
      await updateAthleteProfile({ avatar_url: uploaded.url }, accessToken);
      const updated = await getAthleteIdentity(accessToken);
      setIdentity(updated);
      toast.success("Foto de perfil atualizada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar foto.");
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleAvatarRemove() {
    setAvatarUploading(true);
    try {
      await updateAthleteProfile({ avatar_url: null }, accessToken);
      const updated = await getAthleteIdentity(accessToken);
      setIdentity(updated);
      toast.success("Foto de perfil removida.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao remover foto.");
    } finally {
      setAvatarUploading(false);
    }
  }

  function buildInviteUrl(invite: OrgInvite): string {
    const path = invite.signupUrl ?? `/register/atleta?inviteToken=${invite.token}`;
    if (typeof window === "undefined") return path;
    return path.startsWith("http") ? path : `${window.location.origin}${path}`;
  }

  async function handleCreateFriendInvite() {
    const email = friendEmail.trim().toLowerCase();
    if (!email) {
      toast.error("Informe o e-mail do amigo.");
      return;
    }

    setFriendInviteCreating(true);
    try {
      const invite = await createInvite(
        {
          invitedEmail: email,
          invitedName: friendName.trim() || undefined,
          label: friendName.trim() ? `Convite para ${friendName.trim()}` : `Convite para ${email}`,
          max_uses: 1,
        },
        accessToken,
      );
      setFriendInvites((prev) => [invite, ...prev]);
      setFriendName("");
      setFriendEmail("");

      await navigator.clipboard.writeText(buildInviteUrl(invite));
      toast.success("Convite individual criado e link copiado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel criar convite.");
    } finally {
      setFriendInviteCreating(false);
    }
  }

  async function copyFriendInvite(invite: OrgInvite) {
    try {
      await navigator.clipboard.writeText(buildInviteUrl(invite));
      toast.success("Link de convite copiado.");
    } catch {
      toast.error("Nao foi possivel copiar o link.");
    }
  }

  return (
    <div className="space-y-6 text-white">
      <PageHeader title="Meu perfil" subtitle="Dados da conta e informações esportivas." />

      {loading ? <LoadingState lines={4} /> : null}
      {error ? (
        <EmptyState
          title="Perfil indisponível"
          description={error}
          action={
            <button
              type="button"
              onClick={() => setReloadKey((prev) => prev + 1)}
              className="inline-flex items-center rounded-xl border border-[#2f5d8f] bg-[#12355d] px-4 py-2 text-sm font-medium text-[#dce9ff] transition hover:bg-[#18436f]"
            >
              Tentar novamente
            </button>
          }
        />
      ) : null}

      {!loading && !error && identity ? (
        <>
          {/* CPF banner when missing and athlete role */}
          {isAthleteRole && !hasCpf ? (
            <div className="flex items-start gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-amber-100">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
              <div>
                <p className="font-semibold text-amber-200">CPF não cadastrado</p>
                <p className="mt-0.5 text-sm text-amber-100/80">
                  Para se inscrever em provas e gerar pagamentos PIX, você precisa informar seu CPF.{" "}
                  <button
                    type="button"
                    className="underline hover:text-amber-200"
                    onClick={() => setEditing(true)}
                  >
                    Preencher agora
                  </button>
                </p>
              </div>
            </div>
          ) : null}

          {/* Account info */}
          <SectionCard title="Informações da conta" description="Dados de autenticação e acesso">
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#24486f] bg-[#0a1d36] p-4">
              <div className="h-16 w-16 overflow-hidden rounded-full border border-[#2f5d8f] bg-[#0f233d]">
                {identity.avatarUrl ? (
                  <img
                    src={identity.avatarUrl}
                    alt="Foto de perfil"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xl font-bold text-[#8eb0dc]">
                    {initialsFromName(identity.name)}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex cursor-pointer items-center rounded-xl border border-[#2f5d8f] bg-[#12355d] px-3 py-2 text-sm font-medium text-[#dce9ff] transition hover:bg-[#18436f]">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml"
                    className="hidden"
                    disabled={avatarUploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.currentTarget.value = "";
                      if (!file) return;
                      void handleAvatarUpload(file);
                    }}
                  />
                  {avatarUploading ? "Enviando..." : "Alterar foto"}
                </label>
                <button
                  type="button"
                  onClick={() => void handleAvatarRemove()}
                  disabled={avatarUploading || !identity.avatarUrl}
                  className="rounded-xl border border-[#2f5d8f] bg-[#0f233d] px-3 py-2 text-sm font-medium text-[#dce9ff] transition hover:bg-[#18436f] disabled:opacity-50"
                >
                  Remover foto
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className={labelClass()}>Codigo de associado</label>
              <input
                className={inputClass(
                  "cursor-not-allowed border-[#34587d] bg-[#091a30] font-semibold text-[#dce9ff] opacity-100",
                )}
                type="text"
                value={identity.memberNumber ?? "Aguardando aprovacao"}
                disabled
              />
              <p className="mt-1 text-xs text-[#6a9ac8]">
                Identificacao oficial do associado, gerada pela assessoria e bloqueada para edicao.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Nome", value: identity.name },
                { label: "Email", value: identity.email },
                { label: "Associado", value: identity.memberNumber ?? "Aguardando aprovação" },
                { label: "Perfil", value: roleLabel },
                { label: "Assessoria", value: organizationName },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl border border-[#24486f] bg-[#0f233d] p-4">
                  <p className="text-xs uppercase tracking-wide text-[#8eb0dc]">{label}</p>
                  <p className="mt-2 text-base font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>
          </SectionCard>

          {userRole === "ATHLETE" ? (
            <SectionCard
              title="Convidar amigo"
              description="Gere um convite individual para um amigo entrar na sua assessoria"
            >
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                <div>
                  <label className={labelClass()}>Nome do amigo</label>
                  <input
                    className={inputClass()}
                    type="text"
                    placeholder="Nome completo"
                    value={friendName}
                    onChange={(event) => setFriendName(event.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass()}>E-mail do amigo</label>
                  <input
                    className={inputClass()}
                    type="email"
                    placeholder="amigo@email.com"
                    value={friendEmail}
                    onChange={(event) => setFriendEmail(event.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => void handleCreateFriendInvite()}
                    disabled={friendInviteCreating}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#F5A623] px-4 py-2 text-sm font-semibold text-[#0A1628] transition hover:bg-[#e59a1f] disabled:opacity-50 md:w-auto"
                  >
                    <UserPlus className="h-4 w-4" />
                    {friendInviteCreating ? "Criando..." : "Criar convite"}
                  </button>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {friendInviteLoading ? (
                  <p className="text-sm text-[#8eb0dc]">Carregando convites...</p>
                ) : friendInvites.length === 0 ? (
                  <p className="rounded-xl border border-[#24486f] bg-[#0a1d36] p-4 text-sm text-[#8eb0dc]">
                    Nenhum convite individual criado ainda.
                  </p>
                ) : (
                  friendInvites.map((invite) => {
                    const accepted = Boolean(invite.accepted_at);
                    const exhausted =
                      typeof invite.max_uses === "number" && invite.used_count >= invite.max_uses;
                    const status = accepted ? "Usado" : exhausted ? "Esgotado" : invite.active ? "Ativo" : "Inativo";

                    return (
                      <div
                        key={invite.id}
                        className="flex flex-col gap-3 rounded-xl border border-[#24486f] bg-[#0a1d36] p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-semibold text-white">
                            {invite.invited_name ?? invite.label ?? "Convite individual"}
                          </p>
                          <p className="text-sm text-[#8eb0dc]">{invite.invited_email ?? "E-mail nao informado"}</p>
                          <p className="text-xs text-[#6a9ac8]">
                            {status} · usos {invite.used_count}/{invite.max_uses ?? "ilimitado"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void copyFriendInvite(invite)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#2f5d8f] bg-[#12355d] px-3 py-2 text-sm font-medium text-[#dce9ff] transition hover:bg-[#18436f]"
                        >
                          <Copy className="h-4 w-4" />
                          Copiar link
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </SectionCard>
          ) : null}

          {/* Profile data */}
          <SectionCard
            title="Dados esportivos"
            description="Informações usadas em inscrições e pagamentos"
          >
            {!editing ? (
              <>
                <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <ProfileField
                    label="CPF"
                    value={identity.cpf ? formatCpf(identity.cpf) : null}
                    sensitive
                  />
                  <ProfileField label="Telefone" value={identity.phone} />
                  <ProfileField label="Cidade" value={identity.city} />
                  <ProfileField label="Estado" value={identity.state} />
                  <ProfileField
                    label="Data de nascimento"
                    value={
                      identity.birthDate
                        ? new Date(identity.birthDate).toLocaleDateString("pt-BR", {
                            timeZone: "UTC",
                          })
                        : null
                    }
                  />
                  <ProfileField
                    label="Gênero"
                    value={identity.gender ? GENDER_LABELS[identity.gender] : null}
                  />
                  <ProfileField
                    label="Nivel esportivo"
                    value={identity.sportLevel ? SPORT_LEVEL_LABELS[identity.sportLevel] : null}
                  />
                  <ProfileField label="Objetivo" value={identity.sportGoal} />
                  <ProfileField
                    label="Proxima prova alvo"
                    value={
                      identity.nextCompetitionDate
                        ? new Date(identity.nextCompetitionDate).toLocaleDateString("pt-BR", {
                            timeZone: "UTC",
                          })
                        : null
                    }
                  />
                </div>

                {identity.emergencyContact ? (
                  <div className="mb-4 rounded-xl border border-[#24486f] bg-[#0a1d36] p-4">
                    <p className="mb-2 text-xs uppercase tracking-wide text-[#8eb0dc]">
                      Contato de emergência
                    </p>
                    <p className="text-sm font-semibold text-white">
                      {identity.emergencyContact.name}
                    </p>
                    <p className="text-sm text-[#8eb0dc]">{identity.emergencyContact.phone}</p>
                    {identity.emergencyContact.relation ? (
                      <p className="text-xs text-[#6a9ac8]">{identity.emergencyContact.relation}</p>
                    ) : null}
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#2f5d8f] bg-[#12355d] px-4 py-2 text-sm font-medium text-[#dce9ff] transition hover:bg-[#18436f]"
                >
                  <Pencil className="h-4 w-4" /> Editar perfil
                </button>
              </>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSave();
                }}
                className="space-y-5"
              >
                {/* CPF */}
                <div>
                  <label className={labelClass()}>
                    CPF {!hasCpf && <span className="text-amber-400">*</span>}
                  </label>
                  <input
                    className={inputClass(cpfError ? "border-red-500/60" : "")}
                    type="text"
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    maxLength={14}
                    value={form.cpf}
                    onChange={(e) => handleCpfChange(e.target.value)}
                  />
                  {cpfError ? <p className="mt-1 text-xs text-red-400">{cpfError}</p> : null}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Telefone */}
                  <div>
                    <label className={labelClass()}>Telefone</label>
                    <input
                      className={inputClass()}
                      type="tel"
                      placeholder="(11) 99999-9999"
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    />
                  </div>

                  {/* Gênero */}
                  <div>
                    <label className={labelClass()}>Gênero</label>
                    <select
                      className={inputClass()}
                      value={form.gender}
                      onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                    >
                      <option value="">Selecionar</option>
                      <option value="M">Masculino</option>
                      <option value="F">Feminino</option>
                      <option value="O">Outro / Prefiro não informar</option>
                    </select>
                  </div>

                  {/* Cidade */}
                  <div>
                    <label className={labelClass()}>Cidade</label>
                    <input
                      className={inputClass()}
                      type="text"
                      placeholder="São Paulo"
                      value={form.city}
                      onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    />
                  </div>

                  {/* Estado */}
                  <div>
                    <label className={labelClass()}>Estado (UF)</label>
                    <select
                      className={inputClass()}
                      value={form.state}
                      onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                    >
                      <option value="">Selecionar</option>
                      {BRAZILIAN_STATES.map((uf) => (
                        <option key={uf} value={uf}>
                          {uf}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Data de nascimento */}
                  <div className="sm:col-span-2">
                    <label className={labelClass()}>Data de nascimento</label>
                    <input
                      className={inputClass("max-w-xs")}
                      type="date"
                      value={form.birth_date}
                      onChange={(e) => setForm((f) => ({ ...f, birth_date: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className={labelClass()}>Nivel esportivo</label>
                    <select
                      className={inputClass()}
                      value={form.sport_level}
                      onChange={(e) => setForm((f) => ({ ...f, sport_level: e.target.value }))}
                    >
                      <option value="">Selecionar</option>
                      <option value="BEGINNER">Iniciante</option>
                      <option value="INTERMEDIATE">Intermediario</option>
                      <option value="ADVANCED">Avancado</option>
                      <option value="ELITE">Performance</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelClass()}>Proxima prova alvo</label>
                    <input
                      className={inputClass()}
                      type="date"
                      value={form.next_competition_date}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, next_competition_date: e.target.value }))
                      }
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className={labelClass()}>Meta principal</label>
                    <select
                      className={inputClass()}
                      value={form.sport_goal}
                      onChange={(e) => setForm((f) => ({ ...f, sport_goal: e.target.value }))}
                    >
                      <option value="">Selecionar</option>
                      <option value="Correr minha primeira prova de 5K">Primeira prova de 5K</option>
                      <option value="Evoluir para 10K com seguranca">Evoluir para 10K</option>
                      <option value="Preparar minha primeira meia maratona 21K">
                        Primeira meia maratona
                      </option>
                      <option value="Preparar maratona 42K">Maratona 42K</option>
                      <option value="Melhorar pace e buscar recorde pessoal">
                        Melhorar pace / RP
                      </option>
                      <option value="Correr por saude e consistencia">Saude e consistencia</option>
                    </select>
                  </div>
                </div>

                {/* Contato de emergência */}
                <div className="rounded-xl border border-[#24486f] bg-[#0a1d36] p-4">
                  <p className="mb-3 text-xs uppercase tracking-wide text-[#8eb0dc]">
                    Contato de emergência
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className={labelClass()}>Nome</label>
                      <input
                        className={inputClass()}
                        type="text"
                        placeholder="Nome completo"
                        value={form.ec_name}
                        onChange={(e) => setForm((f) => ({ ...f, ec_name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className={labelClass()}>Telefone</label>
                      <input
                        className={inputClass()}
                        type="tel"
                        placeholder="(11) 99999-9999"
                        value={form.ec_phone}
                        onChange={(e) => setForm((f) => ({ ...f, ec_phone: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className={labelClass()}>Parentesco / Relação</label>
                      <input
                        className={inputClass()}
                        type="text"
                        placeholder="Ex: Mãe, Cônjuge"
                        value={form.ec_relation}
                        onChange={(e) => setForm((f) => ({ ...f, ec_relation: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={saving || Boolean(cpfError)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#F5A623] px-5 py-2 text-sm font-semibold text-[#0A1628] transition hover:bg-[#e59a1f] disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    {saving ? "Salvando..." : "Salvar perfil"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#2f5d8f] bg-[#12355d] px-5 py-2 text-sm font-medium text-[#dce9ff] transition hover:bg-[#18436f] disabled:opacity-50"
                  >
                    <X className="h-4 w-4" /> Cancelar
                  </button>
                </div>
              </form>
            )}
          </SectionCard>

          {/* Quick links */}
          <SectionCard title="Acessos rápidos" description="Atalhos para a área do atleta">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Link
                href="/minhas-inscricoes"
                className="inline-flex items-center gap-2 rounded-xl border border-[#2f5d8f] bg-[#12355d] px-4 py-3 text-sm font-medium text-[#dce9ff] transition hover:bg-[#18436f]"
              >
                <CircleUserRound className="h-4 w-4" /> Minhas inscrições
              </Link>
              <Link
                href="/financeiro"
                className="inline-flex items-center gap-2 rounded-xl border border-[#2f5d8f] bg-[#12355d] px-4 py-3 text-sm font-medium text-[#dce9ff] transition hover:bg-[#18436f]"
              >
                <Mail className="h-4 w-4" /> Financeiro
              </Link>
              <Link
                href="/configuracoes/conta"
                className="inline-flex items-center gap-2 rounded-xl border border-[#2f5d8f] bg-[#12355d] px-4 py-3 text-sm font-medium text-[#dce9ff] transition hover:bg-[#18436f]"
              >
                <ShieldCheck className="h-4 w-4" /> Configurações
              </Link>
            </div>
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}

function ProfileField({
  label,
  value,
  sensitive = false,
}: {
  label: string;
  value: string | null | undefined;
  sensitive?: boolean;
}) {
  const display = value ?? "—";
  const masked = sensitive && value ? `${value.slice(0, 3)}.***.***-${value.slice(-2)}` : display;

  return (
    <div className="rounded-xl border border-[#24486f] bg-[#0f233d] p-4">
      <p className="text-xs uppercase tracking-wide text-[#8eb0dc]">{label}</p>
      <p className={`mt-2 text-base font-semibold ${value ? "text-white" : "text-[#4a7fa8]"}`}>
        {masked}
      </p>
    </div>
  );
}

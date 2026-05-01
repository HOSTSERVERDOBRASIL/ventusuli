"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Building2, CreditCard, FileText, Link2, Plus, Power, Trash2, UserPlus, Copy } from "lucide-react";
import { toast } from "sonner";
import { useAuthToken } from "@/components/auth/AuthTokenProvider";
import { ActionButton } from "@/components/system/action-button";
import { EmptyState } from "@/components/system/empty-state";
import { LoadingState } from "@/components/system/loading-state";
import { ModuleTabs, type ModuleTabItem } from "@/components/system/module-tabs";
import { PageHeader } from "@/components/system/page-header";
import { SectionCard } from "@/components/system/section-card";
import { StatusBadge } from "@/components/system/status-badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  FinanceProfileSettings,
  createInvite,
  deleteInvite,
  getOrganizationSettings,
  listInvites,
  OrgInvite,
  OrganizationSettings,
  toggleInvite,
  updateOrganizationSettings,
} from "@/services/organization-service";
import { uploadImageFile } from "@/services/upload-service";
import { UserRole } from "@/types";

const ADMIN_ROLES = new Set<UserRole>([UserRole.ADMIN]);
const DEFAULT_ORG_LOGO = "/branding/ventu-suli-logo.png";
const MAX_LOGO_FILE_SIZE = 2 * 1024 * 1024;
type SettingsTab = "brand" | "access" | "finance" | "invites" | "summary";

function inviteLink(token: string): string {
  return `${window.location.origin}/register/atleta?inviteToken=${token}`;
}

function formatExpiry(expiresAt: string | null): string {
  if (!expiresAt) return "Sem expiracao";
  return new Date(expiresAt).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function joinLines(values: string[]): string {
  return values.join("\n");
}

function splitLines(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
  description,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        {description ? <p className="mt-0.5 text-xs text-[#8eb0dc]">{description}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-[#3a8fd4] disabled:opacity-50 ${
          checked ? "border-[#F5A623] bg-[#F5A623]" : "border-[#24486f] bg-[#0f233d]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}

export default function AdminConfiguracoesPage() {
  const { accessToken, userRole, refreshSession } = useAuthToken();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  const [invites, setInvites] = useState<OrgInvite[]>([]);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [newInviteLabel, setNewInviteLabel] = useState("");
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>("brand");

  const [form, setForm] = useState({
    name: "",
    slug: "",
    supportEmail: "",
    primaryColor: "#F5A623",
    logoUrl: "",
    allowAthleteSelfSignup: true,
    requireAthleteApproval: false,
    financeBusinessModel: "ASSESSORIA" as FinanceProfileSettings["businessModel"],
    financeRevenueMode: "MISTO" as FinanceProfileSettings["revenueMode"],
    financeBillingDay: "5",
    financeRecurringMonthlyFee: "0",
    financeRecurringChargeEnabled: false,
    financeRecurringGraceDays: "3",
    financeRecurringDescription: "Mensalidade recorrente do associado",
    financeDefaultEntryKind: "RECEIVABLE" as FinanceProfileSettings["defaultEntryKind"],
    financeDefaultAccountCode: "MENSALIDADE",
    financeDefaultCostCenter: "Operacao",
    financeDefaultPaymentMethod: "PIX",
    financeRequireDueDateForOpenEntries: true,
    financeAllowManualCashbook: true,
    financeCategories: "",
    financeCostCenters: "",
    financePaymentMethods: "",
    financeQuickNotes: "",
  });

  const canEdit = userRole ? ADMIN_ROLES.has(userRole) : false;
  const logoPreviewUrl = form.logoUrl.trim() || settings?.logoUrl || DEFAULT_ORG_LOGO;
  const activeInvites = useMemo(() => invites.filter((invite) => invite.active).length, [invites]);
  const tabs = useMemo<ModuleTabItem<SettingsTab>[]>(
    () => [
      {
        key: "brand",
        label: "Marca",
        audience: "Gestao",
        description: "Nome, slug, logo, cor e canal de suporte.",
        icon: Building2,
        metricLabel: "Plano",
        metricValue: settings?.plan ?? "-",
        metricTone: "info",
      },
      {
        key: "access",
        label: "Acesso",
        audience: "Cadastro",
        description: "Auto-cadastro, aprovacao e entrada de atletas.",
        icon: UserPlus,
        metricLabel: "Aprovacao",
        metricValue: form.requireAthleteApproval ? "Ativa" : "Livre",
        metricTone: form.requireAthleteApproval ? "warning" : "positive",
      },
      {
        key: "finance",
        label: "Financeiro",
        audience: "Tesouraria",
        description: "Mensalidade, contas, centros e formas de pagamento.",
        icon: CreditCard,
        metricLabel: "Recorrencia",
        metricValue: form.financeRecurringChargeEnabled ? "Ativa" : "Inativa",
        metricTone: form.financeRecurringChargeEnabled ? "positive" : "neutral",
      },
      {
        key: "invites",
        label: "Convites",
        audience: "Operacao",
        description: "Links unicos para trazer atletas para a assessoria.",
        icon: Link2,
        metricLabel: "Ativos",
        metricValue: activeInvites,
        metricTone: activeInvites > 0 ? "positive" : "neutral",
      },
      {
        key: "summary",
        label: "Resumo",
        audience: "Diretoria",
        description: "Informacoes comerciais essenciais do tenant.",
        icon: FileText,
        metricLabel: "Edicao",
        metricValue: canEdit ? "Liberada" : "Leitura",
        metricTone: canEdit ? "positive" : "neutral",
      },
    ],
    [
      activeInvites,
      canEdit,
      form.financeRecurringChargeEnabled,
      form.requireAthleteApproval,
      settings?.plan,
    ],
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [payload, inviteList] = await Promise.all([
          getOrganizationSettings(accessToken),
          listInvites(accessToken).catch(() => []),
        ]);

        if (!cancelled) {
          setSettings(payload);
          setForm({
            name: payload.name,
            slug: payload.slug,
            supportEmail: payload.supportEmail,
            primaryColor: payload.primaryColor,
            logoUrl: payload.logoUrl ?? "",
            allowAthleteSelfSignup: payload.allowAthleteSelfSignup,
            requireAthleteApproval: payload.requireAthleteApproval,
            financeBusinessModel: payload.financeProfile.businessModel,
            financeRevenueMode: payload.financeProfile.revenueMode,
            financeBillingDay: payload.financeProfile.billingDay?.toString() ?? "",
            financeRecurringMonthlyFee: String(payload.financeProfile.recurringMonthlyFeeCents ?? 0),
            financeRecurringChargeEnabled: payload.financeProfile.recurringChargeEnabled,
            financeRecurringGraceDays: String(payload.financeProfile.recurringGraceDays ?? 3),
            financeRecurringDescription: payload.financeProfile.recurringDescription,
            financeDefaultEntryKind: payload.financeProfile.defaultEntryKind,
            financeDefaultAccountCode: payload.financeProfile.defaultAccountCode,
            financeDefaultCostCenter: payload.financeProfile.defaultCostCenter,
            financeDefaultPaymentMethod: payload.financeProfile.defaultPaymentMethod,
            financeRequireDueDateForOpenEntries:
              payload.financeProfile.requireDueDateForOpenEntries,
            financeAllowManualCashbook: payload.financeProfile.allowManualCashbook,
            financeCategories: joinLines(payload.financeProfile.categories),
            financeCostCenters: joinLines(payload.financeProfile.costCenters),
            financePaymentMethods: joinLines(payload.financeProfile.paymentMethods),
            financeQuickNotes: joinLines(payload.financeProfile.quickNotes),
          });
          setInvites(inviteList);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Nao foi possivel carregar configuracoes da assessoria.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const onSave = async () => {
    if (!canEdit) return;

    setSaving(true);
    try {
      const payload = await updateOrganizationSettings(
        {
          name: form.name,
          slug: form.slug,
          supportEmail: form.supportEmail,
          primaryColor: form.primaryColor,
          logoUrl: form.logoUrl.trim() ? form.logoUrl.trim() : null,
          allowAthleteSelfSignup: form.allowAthleteSelfSignup,
          requireAthleteApproval: form.requireAthleteApproval,
          financeProfile: {
            businessModel: form.financeBusinessModel,
            revenueMode: form.financeRevenueMode,
            billingDay: form.financeBillingDay.trim() ? Number(form.financeBillingDay) : null,
            recurringMonthlyFeeCents: form.financeRecurringMonthlyFee.trim()
              ? Number(form.financeRecurringMonthlyFee)
              : 0,
            recurringChargeEnabled: form.financeRecurringChargeEnabled,
            recurringGraceDays: form.financeRecurringGraceDays.trim()
              ? Number(form.financeRecurringGraceDays)
              : 3,
            recurringDescription: form.financeRecurringDescription,
            defaultEntryKind: form.financeDefaultEntryKind,
            defaultAccountCode: form.financeDefaultAccountCode,
            defaultCostCenter: form.financeDefaultCostCenter,
            defaultPaymentMethod: form.financeDefaultPaymentMethod,
            requireDueDateForOpenEntries: form.financeRequireDueDateForOpenEntries,
            allowManualCashbook: form.financeAllowManualCashbook,
            categories: splitLines(form.financeCategories),
            costCenters: splitLines(form.financeCostCenters),
            paymentMethods: splitLines(form.financePaymentMethods),
            quickNotes: splitLines(form.financeQuickNotes),
          },
        },
        accessToken,
      );
      setSettings(payload);
      await refreshSession();
      toast.success("Configuracoes salvas com sucesso.");
    } catch (saveError) {
      toast.error(
        saveError instanceof Error ? saveError.message : "Falha ao salvar configuracoes.",
      );
    } finally {
      setSaving(false);
    }
  };

  const onLogoFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";
    if (!selectedFile) return;

    if (!selectedFile.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem valido.");
      return;
    }

    if (selectedFile.size > MAX_LOGO_FILE_SIZE) {
      toast.error("A logo deve ter no maximo 2MB.");
      return;
    }

    setUploadingLogo(true);
    try {
      const uploaded = await uploadImageFile(selectedFile, "branding", accessToken);
      setForm((prev) => ({ ...prev, logoUrl: uploaded.url }));
      toast.success("Logo carregada. Clique em salvar configuracoes para aplicar.");
    } catch (uploadError) {
      toast.error(uploadError instanceof Error ? uploadError.message : "Falha ao carregar logo.");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleCreateInvite = async () => {
    setCreatingInvite(true);
    try {
      const invite = await createInvite({ label: newInviteLabel.trim() || undefined }, accessToken);
      setInvites((prev) => [invite, ...prev]);
      setNewInviteLabel("");
      setShowInviteForm(false);
      toast.success("Convite criado com sucesso.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao criar convite.");
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleToggleInvite = async (invite: OrgInvite) => {
    try {
      const updated = await toggleInvite(invite.id, !invite.active, accessToken);
      setInvites((prev) => prev.map((current) => (current.id === invite.id ? updated : current)));
      toast.success(updated.active ? "Convite reativado." : "Convite desativado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar convite.");
    }
  };

  const handleDeleteInvite = async (invite: OrgInvite) => {
    if (
      !confirm(
        `Excluir o convite "${invite.label ?? invite.token.slice(0, 8) + "..."}"? Esta acao nao pode ser desfeita.`,
      )
    ) {
      return;
    }

    try {
      await deleteInvite(invite.id, accessToken);
      setInvites((prev) => prev.filter((current) => current.id !== invite.id));
      toast.success("Convite excluido.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir convite.");
    }
  };

  const copyLink = (token: string) => {
    const link = inviteLink(token);
    void navigator.clipboard.writeText(link).then(() => {
      toast.success("Link de convite copiado!");
    });
  };

  return (
    <div className="space-y-6 text-white">
      <PageHeader
        title="Configuracoes da assessoria"
        subtitle="Branding, regras de onboarding e convites do tenant."
      />

      {loading ? (
        <LoadingState lines={4} />
      ) : error || !settings ? (
        <EmptyState
          title="Configuracoes indisponiveis"
          description={error ?? "Falha ao carregar configuracoes da assessoria."}
        />
      ) : (
        <>
          <SectionCard
            title="Modulo de configuracoes"
            description="Separe marca, acesso, financeiro, convites e resumo comercial em abas."
          >
            <ModuleTabs
              tabs={tabs}
              activeTab={activeTab}
              onChange={setActiveTab}
              columnsClassName="md:grid-cols-5"
            />
          </SectionCard>

          <SectionCard
            className={activeTab === "brand" ? undefined : "hidden"}
            title="Identidade da marca"
            description="Nome, slug, logo e cor principal da assessoria."
            action={
              <StatusBadge
                label={canEdit ? "EDITAVEL" : "SOMENTE LEITURA"}
                tone={canEdit ? "positive" : "neutral"}
              />
            }
          >
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Nome da assessoria"
                className="border-white/15 bg-[#0F2743] text-white"
                disabled={!canEdit}
              />
              <Input
                value={form.slug}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    slug: event.target.value.toLowerCase().replace(/\s+/g, "-"),
                  }))
                }
                placeholder="slug-comercial"
                className="border-white/15 bg-[#0F2743] text-white"
                disabled={!canEdit}
              />

              <div className="grid gap-3 rounded-xl border border-white/10 bg-[#0F2743] p-3 md:col-span-2 md:grid-cols-[104px_1fr]">
                <div className="flex h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-xl border border-white/20 bg-[#0a1d36]">
                  <img
                    src={logoPreviewUrl}
                    alt="Logo da assessoria"
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="space-y-2">
                  <Input
                    value={form.logoUrl}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, logoUrl: event.target.value }))
                    }
                    placeholder="https://cdn.seudominio.com/logo.png"
                    className="border-white/15 bg-[#0a1d36] text-white"
                    disabled={!canEdit}
                  />

                  {canEdit ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex cursor-pointer items-center rounded-lg border border-[#2f5d8f] bg-[#0a1d36] px-3 py-2 text-xs font-medium text-[#c8dbf8] transition hover:border-[#4f7fb4]">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml"
                          className="hidden"
                          onChange={(event) => void onLogoFileChange(event)}
                          disabled={!canEdit || uploadingLogo}
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
                  ) : null}

                  <p className="text-[11px] text-slate-400">
                    PNG, JPG, WEBP, GIF ou SVG com ate 2MB.
                  </p>
                </div>
              </div>

              <Input
                value={form.supportEmail}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, supportEmail: event.target.value }))
                }
                placeholder="suporte@suaassessoria.com"
                className="border-white/15 bg-[#0F2743] text-white"
                disabled={!canEdit}
              />
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0F2743] px-3 py-2">
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, primaryColor: event.target.value }))
                  }
                  className="h-8 w-10 cursor-pointer rounded border border-white/15 bg-transparent"
                  disabled={!canEdit}
                />
                <span className="text-sm text-slate-200">{form.primaryColor}</span>
              </div>
            </div>

            {canEdit ? (
              <div className="mt-4">
                <ActionButton onClick={() => void onSave()} disabled={saving}>
                  {saving ? "Salvando..." : "Salvar configuracoes"}
                </ActionButton>
              </div>
            ) : (
              <p className="mt-4 text-xs text-slate-300">
                Apenas administradores podem alterar estas configuracoes.
              </p>
            )}
          </SectionCard>

          <SectionCard
            className={activeTab === "access" ? undefined : "hidden"}
            title="Regras de entrada de atletas"
            description="Controle como novos atletas acessam sua assessoria."
          >
            <div className="space-y-4">
              <Toggle
                label="Permitir auto-cadastro por slug"
                description="Quando ativo, qualquer pessoa com o slug da assessoria pode criar uma conta de atleta."
                checked={form.allowAthleteSelfSignup}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, allowAthleteSelfSignup: value }))
                }
                disabled={!canEdit}
              />
              <div className="h-px bg-white/10" />
              <Toggle
                label="Exigir aprovacao antes de liberar acesso"
                description="Quando ativo, novos atletas ficam pendentes ate serem aprovados manualmente no painel."
                checked={form.requireAthleteApproval}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, requireAthleteApproval: value }))
                }
                disabled={!canEdit}
              />
            </div>

            {form.requireAthleteApproval ? (
              <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                Atletas cadastrados ficarao com status <strong>Pendente de aprovacao</strong> ate
                revisao no painel.
              </p>
            ) : null}

            {canEdit ? (
              <div className="mt-4">
                <ActionButton onClick={() => void onSave()} disabled={saving}>
                  {saving ? "Salvando..." : "Salvar regras de acesso"}
                </ActionButton>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard
            className={activeTab === "finance" ? undefined : "hidden"}
            title="Modelo financeiro da operacao"
            description="Defina como a assessoria cobra, classifica e controla receitas e despesas."
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Select
                value={form.financeBusinessModel}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    financeBusinessModel: event.target.value as FinanceProfileSettings["businessModel"],
                  }))
                }
                className="border-white/15 bg-[#0F2743] text-white"
                disabled={!canEdit}
              >
                <option value="ASSESSORIA">Assessoria esportiva</option>
                <option value="GRUPO_CORRIDA">Grupo de corrida</option>
                <option value="ASSOCIACAO">Associacao</option>
                <option value="CLUBE">Clube</option>
              </Select>

              <Select
                value={form.financeRevenueMode}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    financeRevenueMode: event.target.value as FinanceProfileSettings["revenueMode"],
                  }))
                }
                className="border-white/15 bg-[#0F2743] text-white"
                disabled={!canEdit}
              >
                <option value="MENSALIDADES">Receita por mensalidades</option>
                <option value="EVENTOS">Receita por eventos</option>
                <option value="MISTO">Receita mista</option>
                <option value="PATROCINIOS">Receita por patrocinios</option>
              </Select>

              <Input
                type="number"
                min={1}
                max={31}
                value={form.financeBillingDay}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, financeBillingDay: event.target.value }))
                }
                placeholder="Dia padrao da cobranca"
                className="border-white/15 bg-[#0F2743] text-white"
                disabled={!canEdit}
              />

              <Input
                type="number"
                min={0}
                value={form.financeRecurringMonthlyFee}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, financeRecurringMonthlyFee: event.target.value }))
                }
                placeholder="Mensalidade em centavos"
                className="border-white/15 bg-[#0F2743] text-white"
                disabled={!canEdit}
              />

              <Input
                type="number"
                min={0}
                max={31}
                value={form.financeRecurringGraceDays}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, financeRecurringGraceDays: event.target.value }))
                }
                placeholder="Dias extras apos vencimento"
                className="border-white/15 bg-[#0F2743] text-white"
                disabled={!canEdit}
              />

              <Select
                value={form.financeDefaultEntryKind}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    financeDefaultEntryKind: event.target.value as FinanceProfileSettings["defaultEntryKind"],
                  }))
                }
                className="border-white/15 bg-[#0F2743] text-white"
                disabled={!canEdit}
              >
                <option value="RECEIVABLE">Conta a receber padrao</option>
                <option value="PAYABLE">Conta a pagar padrao</option>
                <option value="CASH">Livro-caixa padrao</option>
              </Select>

              <Input
                value={form.financeRecurringDescription}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, financeRecurringDescription: event.target.value }))
                }
                placeholder="Descricao da mensalidade"
                className="border-white/15 bg-[#0F2743] text-white"
                disabled={!canEdit}
              />

              <Input
                value={form.financeDefaultAccountCode}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, financeDefaultAccountCode: event.target.value }))
                }
                placeholder="Plano de contas padrao"
                className="border-white/15 bg-[#0F2743] text-white"
                disabled={!canEdit}
              />

              <Input
                value={form.financeDefaultCostCenter}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, financeDefaultCostCenter: event.target.value }))
                }
                placeholder="Centro de custo padrao"
                className="border-white/15 bg-[#0F2743] text-white"
                disabled={!canEdit}
              />

              <Input
                value={form.financeDefaultPaymentMethod}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, financeDefaultPaymentMethod: event.target.value }))
                }
                placeholder="Forma de pagamento padrao"
                className="border-white/15 bg-[#0F2743] text-white"
                disabled={!canEdit}
              />
            </div>

            <div className="mt-4 space-y-4">
              <Toggle
                label="Exigir vencimento para titulos em aberto"
                description="Padroniza a cobranca e facilita o controle de inadimplencia."
                checked={form.financeRequireDueDateForOpenEntries}
                onChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    financeRequireDueDateForOpenEntries: value,
                  }))
                }
                disabled={!canEdit}
              />
              <div className="h-px bg-white/10" />
              <Toggle
                label="Ativar mensalidade recorrente"
                description="Permite gerar automaticamente a carteira mensal dos associados ativos."
                checked={form.financeRecurringChargeEnabled}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, financeRecurringChargeEnabled: value }))
                }
                disabled={!canEdit}
              />
              <div className="h-px bg-white/10" />
              <Toggle
                label="Permitir livro-caixa manual"
                description="Desative para forcar o time a operar em contas a pagar/receber com baixa."
                checked={form.financeAllowManualCashbook}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, financeAllowManualCashbook: value }))
                }
                disabled={!canEdit}
              />
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Textarea
                value={form.financeCategories}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, financeCategories: event.target.value }))
                }
                placeholder={"Categorias sugeridas\nMensalidades\nInscricoes\nPatrocinios"}
                className="min-h-[140px] border-white/15 bg-[#0F2743] text-white"
                disabled={!canEdit}
              />
              <Textarea
                value={form.financeCostCenters}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, financeCostCenters: event.target.value }))
                }
                placeholder={"Centros de custo\nOperacao\nEventos\nEquipe"}
                className="min-h-[140px] border-white/15 bg-[#0F2743] text-white"
                disabled={!canEdit}
              />
              <Textarea
                value={form.financePaymentMethods}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, financePaymentMethods: event.target.value }))
                }
                placeholder={"Formas de pagamento\nPIX\nCartao\nBoleto"}
                className="min-h-[140px] border-white/15 bg-[#0F2743] text-white"
                disabled={!canEdit}
              />
              <Textarea
                value={form.financeQuickNotes}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, financeQuickNotes: event.target.value }))
                }
                placeholder={"Anotacoes operacionais\nMensalidade recorrente do associado\nRateio da equipe"}
                className="min-h-[140px] border-white/15 bg-[#0F2743] text-white"
                disabled={!canEdit}
              />
            </div>

            <p className="mt-3 text-xs text-slate-300">
              Cada linha vira uma sugestao pratica dentro do financeiro administrativo.
            </p>

            {canEdit ? (
              <div className="mt-4">
                <ActionButton onClick={() => void onSave()} disabled={saving}>
                  {saving ? "Salvando..." : "Salvar modelo financeiro"}
                </ActionButton>
              </div>
            ) : null}
          </SectionCard>

          {canEdit ? (
            <SectionCard
              className={activeTab === "invites" ? undefined : "hidden"}
              title="Convites de entrada"
              description="Gere links unicos para convidar atletas diretamente para sua assessoria."
              action={
                <ActionButton size="sm" onClick={() => setShowInviteForm((value) => !value)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Novo convite
                </ActionButton>
              }
            >
              {showInviteForm ? (
                <div className="mb-4 flex items-center gap-3 rounded-xl border border-[#24486f] bg-[#0a1d36] p-3">
                  <Input
                    value={newInviteLabel}
                    onChange={(event) => setNewInviteLabel(event.target.value)}
                    placeholder="Rotulo do convite (ex: Turma Maio 2026)"
                    className="border-white/15 bg-[#0F2743] text-white"
                  />
                  <ActionButton
                    size="sm"
                    disabled={creatingInvite}
                    onClick={() => void handleCreateInvite()}
                  >
                    {creatingInvite ? "Criando..." : "Criar"}
                  </ActionButton>
                  <button
                    type="button"
                    onClick={() => setShowInviteForm(false)}
                    className="text-xs text-[#8eb0dc] hover:text-white"
                  >
                    Cancelar
                  </button>
                </div>
              ) : null}

              {invites.length === 0 ? (
                <p className="text-sm text-[#8eb0dc]">
                  Nenhum convite criado ainda. Crie um para compartilhar com seus atletas.
                </p>
              ) : (
                <div className="divide-y divide-white/10">
                  {invites.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">
                          {invite.label ?? <span className="text-[#8eb0dc]">Sem rotulo</span>}
                        </p>
                        <p className="mt-0.5 font-mono text-xs text-[#4a7fa8]">
                          {invite.token.slice(0, 16)}...
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#8eb0dc]">
                          <span>
                            {invite.used_count} uso{invite.used_count !== 1 ? "s" : ""}
                          </span>
                          {invite.max_uses ? <span>/ max {invite.max_uses}</span> : null}
                          <span>· {formatExpiry(invite.expires_at)}</span>
                          <StatusBadge
                            label={invite.active ? "ATIVO" : "INATIVO"}
                            tone={invite.active ? "positive" : "neutral"}
                            className="text-[10px]"
                          />
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          title="Copiar link de convite"
                          onClick={() => copyLink(invite.token)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#2f5d8f] bg-[#0f233d] text-[#8eb0dc] transition hover:bg-[#18436f] hover:text-white"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title={invite.active ? "Desativar convite" : "Reativar convite"}
                          onClick={() => void handleToggleInvite(invite)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#2f5d8f] bg-[#0f233d] text-[#8eb0dc] transition hover:bg-[#18436f] hover:text-white"
                        >
                          <Power
                            className={`h-3.5 w-3.5 ${invite.active ? "text-emerald-400" : "text-slate-500"}`}
                          />
                        </button>
                        <button
                          type="button"
                          title="Excluir convite"
                          onClick={() => void handleDeleteInvite(invite)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/30 bg-[#0f233d] text-red-400/60 transition hover:bg-red-500/10 hover:text-red-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#24486f] bg-[#0a1d36] px-3 py-2 text-xs text-[#8eb0dc]">
                <Link2 className="h-4 w-4 shrink-0 text-[#38bdf8]" />
                <p>
                  O link de convite tem formato:{" "}
                  <span className="font-mono text-white">
                    {typeof window !== "undefined" ? window.location.origin : ""}
                    /register/atleta?inviteToken=TOKEN
                  </span>
                </p>
              </div>
            </SectionCard>
          ) : null}

          <SectionCard
            className={activeTab === "summary" ? undefined : "hidden"}
            title="Resumo comercial"
            description="Informacoes essenciais da plataforma"
          >
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-[#24486f] bg-[#0f233d] p-3">
                <p className="text-xs uppercase tracking-wide text-[#8eb0dc]">Assessoria</p>
                <p className="mt-1 text-lg font-semibold text-white">{settings.name}</p>
              </div>
              <div className="rounded-xl border border-[#24486f] bg-[#0f233d] p-3">
                <p className="text-xs uppercase tracking-wide text-[#8eb0dc]">Plano</p>
                <p className="mt-1 text-lg font-semibold text-white">{settings.plan}</p>
              </div>
              <div className="rounded-xl border border-[#24486f] bg-[#0f233d] p-3">
                <p className="text-xs uppercase tracking-wide text-[#8eb0dc]">Suporte</p>
                <p className="mt-1 text-lg font-semibold text-white">
                  {settings.supportEmail || "Nao definido"}
                </p>
              </div>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}

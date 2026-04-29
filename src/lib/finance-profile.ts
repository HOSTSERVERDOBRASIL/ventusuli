type EntryKind = "CASH" | "RECEIVABLE" | "PAYABLE";

export type FinanceBusinessModel = "ASSESSORIA" | "GRUPO_CORRIDA" | "ASSOCIACAO" | "CLUBE";
export type FinanceRevenueMode = "MENSALIDADES" | "EVENTOS" | "MISTO" | "PATROCINIOS";

export interface FinanceProfile {
  businessModel: FinanceBusinessModel;
  revenueMode: FinanceRevenueMode;
  billingDay: number | null;
  recurringMonthlyFeeCents: number;
  recurringChargeEnabled: boolean;
  recurringGraceDays: number;
  recurringDescription: string;
  defaultEntryKind: EntryKind;
  defaultAccountCode: string;
  defaultCostCenter: string;
  defaultPaymentMethod: string;
  requireDueDateForOpenEntries: boolean;
  allowManualCashbook: boolean;
  categories: string[];
  costCenters: string[];
  paymentMethods: string[];
  quickNotes: string[];
}

type FinanceProfileInput = Partial<FinanceProfile>;

const DEFAULT_PROFILE: FinanceProfile = {
  businessModel: "ASSESSORIA",
  revenueMode: "MISTO",
  billingDay: 5,
  recurringMonthlyFeeCents: 0,
  recurringChargeEnabled: false,
  recurringGraceDays: 3,
  recurringDescription: "Mensalidade recorrente do associado",
  defaultEntryKind: "RECEIVABLE",
  defaultAccountCode: "MENSALIDADE",
  defaultCostCenter: "Operacao",
  defaultPaymentMethod: "PIX",
  requireDueDateForOpenEntries: true,
  allowManualCashbook: true,
  categories: ["Mensalidades", "Inscricoes", "Patrocinios", "Equipe tecnica", "Marketing"],
  costCenters: ["Operacao", "Eventos", "Equipe", "Marketing", "Administrativo"],
  paymentMethods: ["PIX", "Cartao", "Dinheiro", "Transferencia", "Boleto"],
  quickNotes: [
    "Mensalidade recorrente do associado",
    "Inscricao ou reembolso de prova",
    "Patrocinio ou parceria comercial",
  ],
};

function readObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed)) return parsed;
  }
  return null;
}

function cleanList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const normalized = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item): item is string => item.length > 0);
  return normalized.length > 0 ? Array.from(new Set(normalized)) : fallback;
}

function isBusinessModel(value: unknown): value is FinanceBusinessModel {
  return (
    value === "ASSESSORIA" ||
    value === "GRUPO_CORRIDA" ||
    value === "ASSOCIACAO" ||
    value === "CLUBE"
  );
}

function isRevenueMode(value: unknown): value is FinanceRevenueMode {
  return (
    value === "MENSALIDADES" ||
    value === "EVENTOS" ||
    value === "MISTO" ||
    value === "PATROCINIOS"
  );
}

function isEntryKind(value: unknown): value is EntryKind {
  return value === "CASH" || value === "RECEIVABLE" || value === "PAYABLE";
}

function profileTemplate(
  businessModel: FinanceBusinessModel,
  revenueMode: FinanceRevenueMode,
): Partial<FinanceProfile> {
  if (businessModel === "ASSOCIACAO") {
    return {
      defaultAccountCode: "CONTRIBUICAO_ASSOCIATIVA",
      defaultCostCenter: "Associados",
      categories: ["Contribuicoes", "Eventos", "Uniformes", "Equipe", "Administrativo"],
      costCenters: ["Associados", "Eventos", "Projetos", "Administrativo"],
    };
  }

  if (businessModel === "GRUPO_CORRIDA") {
    return {
      defaultAccountCode: "CAIXA_GRUPO",
      defaultCostCenter: "Treinos",
      categories: ["Rateios", "Eventos", "Camisetas", "Hidratacao", "Premiacoes"],
      costCenters: ["Treinos", "Eventos", "Comunidade", "Administrativo"],
    };
  }

  if (businessModel === "CLUBE") {
    return {
      defaultAccountCode: "CONTRATO_MEMBRO",
      defaultCostCenter: "Clube",
      categories: ["Planos", "Eventos", "Patrocinios", "Estrutura", "Comissoes"],
      costCenters: ["Clube", "Eventos", "Loja", "Administrativo"],
    };
  }

  if (revenueMode === "EVENTOS") {
    return { defaultAccountCode: "INSCRICAO_EVENTO", defaultEntryKind: "RECEIVABLE" };
  }

  if (revenueMode === "PATROCINIOS") {
    return { defaultAccountCode: "PATROCINIO", defaultEntryKind: "RECEIVABLE" };
  }

  return {};
}

export function normalizeFinanceProfile(settings: unknown): FinanceProfile {
  const root = readObject(settings);
  const rawProfile = readObject(root?.finance);
  const rawBusinessModel = rawProfile?.businessModel;
  const rawRevenueMode = rawProfile?.revenueMode;
  const rawEntryKind = rawProfile?.defaultEntryKind;
  const businessModel = isBusinessModel(rawBusinessModel)
    ? rawBusinessModel
    : DEFAULT_PROFILE.businessModel;
  const revenueMode = isRevenueMode(rawRevenueMode)
    ? rawRevenueMode
    : DEFAULT_PROFILE.revenueMode;
  const template = profileTemplate(businessModel, revenueMode);
  const billingDay = readInteger(rawProfile?.billingDay);

  return {
    businessModel,
    revenueMode,
    billingDay: billingDay !== null && billingDay >= 1 && billingDay <= 31
      ? billingDay
      : DEFAULT_PROFILE.billingDay,
    recurringMonthlyFeeCents: (() => {
      const rawValue = readInteger(rawProfile?.recurringMonthlyFeeCents);
      return rawValue !== null && rawValue >= 0 ? rawValue : DEFAULT_PROFILE.recurringMonthlyFeeCents;
    })(),
    recurringChargeEnabled: readBoolean(
      rawProfile?.recurringChargeEnabled,
      DEFAULT_PROFILE.recurringChargeEnabled,
    ),
    recurringGraceDays: (() => {
      const rawValue = readInteger(rawProfile?.recurringGraceDays);
      return rawValue !== null && rawValue >= 0 && rawValue <= 31
        ? rawValue
        : DEFAULT_PROFILE.recurringGraceDays;
    })(),
    recurringDescription: readString(
      rawProfile?.recurringDescription,
      DEFAULT_PROFILE.recurringDescription,
    ),
    defaultEntryKind: isEntryKind(rawEntryKind)
      ? rawEntryKind
      : (template.defaultEntryKind ?? DEFAULT_PROFILE.defaultEntryKind),
    defaultAccountCode: readString(
      rawProfile?.defaultAccountCode,
      template.defaultAccountCode ?? DEFAULT_PROFILE.defaultAccountCode,
    ),
    defaultCostCenter: readString(
      rawProfile?.defaultCostCenter,
      template.defaultCostCenter ?? DEFAULT_PROFILE.defaultCostCenter,
    ),
    defaultPaymentMethod: readString(
      rawProfile?.defaultPaymentMethod,
      DEFAULT_PROFILE.defaultPaymentMethod,
    ),
    requireDueDateForOpenEntries: readBoolean(
      rawProfile?.requireDueDateForOpenEntries,
      DEFAULT_PROFILE.requireDueDateForOpenEntries,
    ),
    allowManualCashbook: readBoolean(
      rawProfile?.allowManualCashbook,
      DEFAULT_PROFILE.allowManualCashbook,
    ),
    categories: cleanList(
      rawProfile?.categories,
      template.categories ?? DEFAULT_PROFILE.categories,
    ),
    costCenters: cleanList(
      rawProfile?.costCenters,
      template.costCenters ?? DEFAULT_PROFILE.costCenters,
    ),
    paymentMethods: cleanList(rawProfile?.paymentMethods, DEFAULT_PROFILE.paymentMethods),
    quickNotes: cleanList(rawProfile?.quickNotes, DEFAULT_PROFILE.quickNotes),
  };
}

export function mergeFinanceProfileSettings(
  currentSettings: unknown,
  input: FinanceProfileInput | undefined,
): Record<string, unknown> {
  const current = readObject(currentSettings) ?? {};
  if (!input) return current;

  const currentFinance = readObject(current.finance) ?? {};
  return {
    ...current,
    finance: {
      ...currentFinance,
      ...input,
    },
  };
}

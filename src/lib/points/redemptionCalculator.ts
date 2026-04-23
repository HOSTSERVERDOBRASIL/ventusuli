export const POINT_VALUE_BRL = 0.1;

export interface RewardItem {
  cashPriceCents: number;
  pointsCost: number;
  maxPointsDiscountPercent: number;
  minimumCashCents: number;
  allowMixed: boolean;
  allowPoints: boolean;
  active: boolean;
  stockQuantity: number;
}

export interface RedemptionCalculation {
  pointsUsed: number;
  cashCents: number;
  maxPointsAllowed: number;
  abatementCents: number;
  explanation: string;
  isValid: boolean;
  validationError?: string;
}

const BRL_CURRENCY = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function calculateRedemption(
  item: RewardItem,
  userBalance: number,
  requestedPoints?: number,
): RedemptionCalculation {
  const maxAbatementCents = (item.cashPriceCents * item.maxPointsDiscountPercent) / 100;
  const maxPointsFromPercent = Math.floor(maxAbatementCents / (POINT_VALUE_BRL * 100));
  const maxPointsAllowed = Math.min(userBalance, item.pointsCost, maxPointsFromPercent);

  const pointsUsed =
    requestedPoints != null
      ? Math.min(Math.max(requestedPoints, 0), maxPointsAllowed)
      : maxPointsAllowed;

  const abatementCents = Math.floor(pointsUsed * POINT_VALUE_BRL * 100);
  const cashCents = Math.max(item.cashPriceCents - abatementCents, item.minimumCashCents);

  let isValid = true;
  let validationError: string | undefined;

  if (!item.active || item.stockQuantity <= 0) {
    isValid = false;
    validationError = "Item indisponivel para resgate.";
  } else if (userBalance < pointsUsed) {
    isValid = false;
    validationError = "Saldo insuficiente para a quantidade de pontos usada.";
  } else if (!item.allowPoints && pointsUsed > 0) {
    isValid = false;
    validationError = "Este item nao permite uso de pontos.";
  } else if (!item.allowMixed && pointsUsed > 0 && cashCents > 0) {
    isValid = false;
    validationError = "Este item nao permite pagamento misto (pontos + dinheiro).";
  }

  const explanation = `${pointsUsed} pontos usados (max. ${item.maxPointsDiscountPercent}% = ${maxPointsFromPercent} pts), complemento ${BRL_CURRENCY.format(cashCents / 100)}`;

  return {
    pointsUsed,
    cashCents,
    maxPointsAllowed,
    abatementCents,
    explanation,
    isValid,
    validationError,
  };
}

const specExample = calculateRedemption(
  {
    cashPriceCents: 6000,
    pointsCost: 300,
    maxPointsDiscountPercent: 40,
    minimumCashCents: 0,
    allowMixed: true,
    allowPoints: true,
    active: true,
    stockQuantity: 5,
  },
  300,
);

console.assert(specExample.pointsUsed === 240, "Spec falhou: pointsUsed deve ser 240");
console.assert(specExample.cashCents === 3600, "Spec falhou: cashCents deve ser 3600");

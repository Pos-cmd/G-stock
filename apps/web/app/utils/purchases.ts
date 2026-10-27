import type { AllocationMethod, FeeCurrency } from "@G-stock/core/enums";
import { formatFcfa, formatQty, formatRmb, formatUsd } from "@G-stock/core/format";
import { ALLOCATION_METHOD_LABELS } from "@G-stock/core/labels";
import { computeFeesFcfa } from "@G-stock/core/purchasing";
import type { LandedCostFees } from "@G-stock/core/purchasing";

/** Une ligne de frais telle qu'affichée dans le récapitulatif du prix de revient. */
export interface FeeLineDisplay {
  label: string;
  detail?: string;
  amountFcfa: number;
}

/** Frais estimés à la commande : fret CBM, transport local, autres frais. */
export const estimateFeeLines = (fees: LandedCostFees): FeeLineDisplay[] => [
  {
    amountFcfa: computeFeesFcfa(fees).freightFcfa,
    detail: `${formatQty(fees.freightCbm, "CBM")} × ${formatFcfa(fees.freightRatePerCbmFcfa)}`,
    label: "Fret maritime",
  },
  { amountFcfa: fees.localTransportFcfa, label: "Transport local" },
  { amountFcfa: fees.otherFeesFcfa, label: "Autres frais" },
];

const formatFeeAmount = (amount: number, currency: FeeCurrency): string | null => {
  if (currency === "usd") {
    return formatUsd(amount);
  }
  if (currency === "rmb") {
    return formatRmb(amount);
  }
  return null;
};

/** Frais réels saisis à la réception : montant d'origine et méthode de répartition en détail. */
export const receptionFeeLines = (
  fees: readonly {
    label: string;
    amount: number;
    currency: FeeCurrency;
    amountFcfa: number;
    allocationMethod: AllocationMethod;
  }[],
): FeeLineDisplay[] =>
  fees.map((fee) => ({
    amountFcfa: fee.amountFcfa,
    detail: [
      formatFeeAmount(fee.amount, fee.currency),
      ALLOCATION_METHOD_LABELS[fee.allocationMethod].toLowerCase(),
    ]
      .filter(Boolean)
      .join(" · "),
    label: fee.label || "Frais",
  }));

/** Sous « Marchandise » quand des versements au fournisseur sont enregistrés. */
export const PAID_GOODS_HINT = "Versements à leur taux, reste au taux de la commande";

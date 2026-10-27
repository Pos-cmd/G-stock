import { comparisonKey, normalizeLabel } from "@G-stock/core/comparison";
import type { PricingBasis } from "@G-stock/core/enums";
import { PURCHASE_ORDER_STATUS_LABELS } from "@G-stock/core/labels";
import { computeFeesFcfa } from "@G-stock/core/purchasing";
import type { Executor } from "@G-stock/db";
import { products } from "@G-stock/db/schema/catalog";

import type { ComparisonItem } from "../schemas/comparison";
import { getPurchaseOrder } from "./purchases";
import { getSimulation } from "./simulations";

export interface ComparableLine {
  key: string;
  label: string;
  unit: string;
  qty: number;
  weightTons: number | null;
  unitPriceRmb: number;
  pricingBasis: PricingBasis;
  unitCostFcfa: number;
  salePriceFcfa: number | null;
}

/** Une colonne de la comparaison : simulation ou commande, ramenée aux mêmes indicateurs. */
export interface ComparableColumn {
  key: string;
  type: ComparisonItem["type"];
  id: string;
  title: string;
  subtitle: string;
  date: Date;
  rmbPerUsd: number;
  fcfaPerUsd: number;
  freightCbm: number;
  freightRatePerCbmFcfa: number;
  goodsRmb: number;
  goodsFcfa: number;
  feesFcfa: number;
  totalCostFcfa: number;
  totalWeightTons: number;
  /** Projections : seules les simulations ont des prix de vente. */
  revenueFcfa: number | null;
  marginFcfa: number | null;
  fees: { label: string; amountFcfa: number }[];
  lines: ComparableLine[];
}

const simulationColumn = async (
  executor: Executor,
  id: string,
  productIdByName: Map<string, string>,
): Promise<ComparableColumn> => {
  const simulation = await getSimulation(executor, id);
  const { data, result } = simulation;
  return {
    date: simulation.updatedAt,
    fcfaPerUsd: data.rates.fcfaPerUsd,
    fees: [
      { amountFcfa: result.freightFcfa, label: "Fret maritime" },
      ...result.fees.map((fee) => ({ amountFcfa: fee.amountFcfa, label: fee.label })),
    ],
    feesFcfa: result.feesFcfa,
    freightCbm: data.freightCbm,
    freightRatePerCbmFcfa: data.freightRatePerCbmFcfa,
    goodsFcfa: result.goodsFcfa,
    goodsRmb: result.goodsRmb,
    id,
    key: `simulation-${id}`,
    lines: data.lines.map((line, index) => ({
      key: comparisonKey({
        label: line.label,
        productId: line.productId ?? productIdByName.get(normalizeLabel(line.label)),
      }),
      label: line.label,
      pricingBasis: line.pricingBasis ?? "unit",
      qty: line.qty,
      salePriceFcfa: result.lines[index]?.salePriceFcfa ?? null,
      unit: line.unit,
      unitCostFcfa: result.lines[index]?.unitCostFcfa ?? 0,
      unitPriceRmb: line.unitPriceRmb,
      weightTons: line.weightTons ?? null,
    })),
    marginFcfa: result.marginFcfa,
    revenueFcfa: result.revenueFcfa,
    rmbPerUsd: data.rates.rmbPerUsd,
    subtitle: "Simulation",
    title: simulation.name,
    totalCostFcfa: result.totalCostFcfa,
    totalWeightTons: result.totalWeightTons,
    type: "simulation",
  };
};

const orderColumn = async (executor: Executor, id: string): Promise<ComparableColumn> => {
  const order = await getPurchaseOrder(executor, id);
  const received = order.status === "received";
  // Reçue : frais et quantités réels ; sinon l'estimation de la commande.
  const fees = received
    ? order.fees.map((fee) => ({ amountFcfa: fee.amountFcfa, label: fee.label }))
    : [
        { amountFcfa: computeFeesFcfa(order).freightFcfa, label: "Fret maritime" },
        { amountFcfa: order.localTransportFcfa, label: "Transport local" },
        { amountFcfa: order.otherFeesFcfa, label: "Autres frais" },
      ].filter((fee) => fee.amountFcfa > 0);
  return {
    date: order.receivedAt ?? order.orderDate,
    fcfaPerUsd: order.fcfaPerUsd,
    fees,
    feesFcfa: order.costs.feesFcfa,
    freightCbm: order.freightCbm,
    freightRatePerCbmFcfa: order.freightRatePerCbmFcfa,
    goodsFcfa: order.costs.goodsFcfa,
    goodsRmb: order.costs.goodsRmb,
    id,
    key: `purchase_order-${id}`,
    lines: order.items.map((item) => ({
      key: comparisonKey({ label: item.productName, productId: item.productId }),
      label: item.productName,
      pricingBasis: item.pricingBasis,
      qty: received ? (item.qtyReceived ?? item.qty) : item.qty,
      salePriceFcfa: null,
      unit: item.productUnit,
      unitCostFcfa: item.unitCostFcfa,
      unitPriceRmb: item.unitPriceRmb,
      weightTons: item.weightTons,
    })),
    marginFcfa: null,
    revenueFcfa: null,
    rmbPerUsd: order.rmbPerUsd,
    subtitle: `Commande ${PURCHASE_ORDER_STATUS_LABELS[order.status].toLowerCase()}${received ? " (coûts réels)" : " (estimation)"}`,
    title: order.supplier ? `${order.reference} · ${order.supplier.name}` : order.reference,
    totalCostFcfa: order.costs.totalFcfa,
    totalWeightTons: order.costs.totalWeightTons,
    type: "purchase_order",
  };
};

/**
 * Compare des simulations et des commandes : indicateurs globaux, puis produit par produit
 * (rapprochés par produit du catalogue ou par nom) et frais par frais (par libellé).
 */
export const getComparison = async (executor: Executor, items: readonly ComparisonItem[]) => {
  const catalog = await executor.select({ id: products.id, name: products.name }).from(products);
  const productIdByName = new Map(
    catalog.map((product) => [normalizeLabel(product.name), product.id]),
  );

  const columns = await Promise.all(
    items.map((item) =>
      item.type === "simulation"
        ? simulationColumn(executor, item.id, productIdByName)
        : orderColumn(executor, item.id),
    ),
  );

  // Lignes de produits : ordre de première apparition, une cellule par colonne.
  const productRows = new Map<
    string,
    { key: string; label: string; unit: string; cells: (ComparableLine | null)[] }
  >();
  for (const [index, column] of columns.entries()) {
    for (const line of column.lines) {
      const row = productRows.get(line.key) ?? {
        cells: columns.map(() => null),
        key: line.key,
        label: line.label,
        unit: line.unit,
      };
      // Deux lignes du même produit dans une colonne : on garde la première.
      row.cells[index] ??= line;
      productRows.set(line.key, row);
    }
  }

  const feeRows = new Map<string, { label: string; cells: (number | null)[] }>();
  for (const [index, column] of columns.entries()) {
    for (const fee of column.fees) {
      const key = normalizeLabel(fee.label);
      const row = feeRows.get(key) ?? { cells: columns.map(() => null), label: fee.label };
      row.cells[index] = (row.cells[index] ?? 0) + fee.amountFcfa;
      feeRows.set(key, row);
    }
  }

  return {
    columns: columns.map(({ fees: _fees, lines: _lines, ...column }) => column),
    feeRows: [...feeRows.values()],
    productRows: [...productRows.values()],
  };
};

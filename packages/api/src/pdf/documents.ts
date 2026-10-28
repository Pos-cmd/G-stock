import {
  formatCurrency,
  formatDate,
  formatOrderRates,
  formatQty,
  formatRmb,
  formatUsd,
} from "@G-stock/core/format";
import {
  ALLOCATION_METHOD_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_TYPE_LABELS,
  PURCHASE_CURRENCY_LABELS,
  PURCHASE_ORDER_STATUS_LABELS,
} from "@G-stock/core/labels";
import type { FeeCurrency } from "@G-stock/core/enums";
import { computeFeesFcfa } from "@G-stock/core/purchasing";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";

import type { getPurchaseOrder } from "../services/purchases";
import type { getSale } from "../services/sales";
import type { getSimulation } from "../services/simulations";
import type { Company } from "./theme";
import {
  COLORS,
  dataTable,
  documentFrame,
  infoGrid,
  money,
  notesBlock,
  pdfText,
  sectionTitle,
  summaryBox,
} from "./theme";

type SimulationDetail = Awaited<ReturnType<typeof getSimulation>>;
type SaleDetail = Awaited<ReturnType<typeof getSale>>;
type PurchaseOrderDetail = Awaited<ReturnType<typeof getPurchaseOrder>>;

const percent = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
  style: "percent",
});
const rate = (value: number | null) => (value === null ? "—" : pdfText(percent.format(value)));
const qty = (value: number, unit?: string | null) => pdfText(formatQty(value, unit));
const rmb = (value: number) => pdfText(formatRmb(value));

const feeDetail = (fee: { amount: number; currency: FeeCurrency }) =>
  fee.currency === "fcfa" ? "—" : pdfText(formatCurrency(fee.amount, fee.currency));

/** Simulation d'import : achat, frais, vente et marges. */
export const simulationDocument = (
  simulation: SimulationDetail,
  company: Company,
): TDocumentDefinitions => {
  const { data, result } = simulation;
  const showWeight = data.lines.some((line) => line.weightTons);
  const { freightFcfa } = computeFeesFcfa({
    freightCbm: data.freightCbm,
    freightRatePerCbmFcfa: data.freightRatePerCbmFcfa,
    localTransportFcfa: 0,
    otherFeesFcfa: 0,
  });

  const content: Content[] = [
    infoGrid([
      { label: "Simulation", value: simulation.name },
      { label: "Mise à jour", value: formatDate(simulation.updatedAt) },
      {
        label: "Taux",
        value: `${data.rates.rmbPerUsd} RMB = 1 $ = ${data.rates.fcfaPerUsd} FCFA`,
      },
      {
        label: "Commande",
        value: simulation.orderReference ? `Transformée en ${simulation.orderReference}` : null,
      },
    ]),
    sectionTitle("Achat et prix de revient"),
    dataTable(
      [
        { header: "Produit", width: "*" },
        { align: "right", header: "Quantité" },
        ...(showWeight ? [{ align: "right" as const, header: "Poids" }] : []),
        { align: "right", header: "Prix fournisseur" },
        { align: "right", header: "Marchandise" },
        { align: "right", header: "Part des frais" },
        { align: "right", header: "Revient unitaire" },
      ],
      data.lines.map((line, index) => {
        const computed = result.lines[index];
        return [
          line.label,
          qty(line.qty, line.unit),
          ...(showWeight ? [line.weightTons ? qty(line.weightTons, "T") : "—"] : []),
          `${rmb(line.unitPriceRmb)}${line.pricingBasis === "weight" ? " / T" : ""}`,
          money(computed?.goodsFcfa ?? 0),
          money(computed?.transportShareFcfa ?? 0),
          { bold: true, text: money(computed?.unitCostFcfa ?? 0) },
        ];
      }),
      [
        "Total",
        "",
        ...(showWeight ? [result.totalWeightTons > 0 ? qty(result.totalWeightTons, "T") : ""] : []),
        rmb(result.goodsRmb),
        money(result.goodsFcfa),
        money(result.feesFcfa),
        money(result.totalCostFcfa),
      ],
    ),
    sectionTitle("Frais d'approche"),
    dataTable(
      [
        { header: "Frais", width: "*" },
        { align: "right", header: "Montant d'origine" },
        { header: "Répartition" },
        { align: "right", header: "En FCFA" },
      ],
      [
        [
          `Fret maritime (${qty(data.freightCbm, "CBM")} × ${money(data.freightRatePerCbmFcfa)})`,
          "—",
          ALLOCATION_METHOD_LABELS[data.freightAllocation],
          money(freightFcfa),
        ],
        ...data.fees.map((fee, index) => [
          fee.label,
          feeDetail(fee),
          ALLOCATION_METHOD_LABELS[fee.allocationMethod],
          money(result.fees[index]?.amountFcfa ?? 0),
        ]),
      ],
      ["Total des frais", "", "", money(result.feesFcfa)],
    ),
    sectionTitle("Prix de vente et marges"),
    dataTable(
      [
        { header: "Produit", width: "*" },
        { align: "right", header: "Revient" },
        { align: "right", header: "Prix de vente" },
        { align: "right", header: "Marge / unité" },
        { align: "right", header: "% revient" },
        { align: "right", header: "% vente" },
        { align: "right", header: "Marge totale" },
      ],
      data.lines.map((line, index) => {
        const computed = result.lines[index];
        const margin = computed?.marginFcfa ?? 0;
        return [
          line.label,
          money(computed?.unitCostFcfa ?? 0),
          { bold: true, text: money(computed?.salePriceFcfa ?? 0) },
          money(computed?.unitMarginFcfa ?? 0),
          rate(computed?.markupRate ?? null),
          rate(computed?.marginRate ?? null),
          {
            color: margin < 0 ? COLORS.danger : COLORS.primary,
            text: money(margin),
          },
        ];
      }),
    ),
    summaryBox([
      { label: "Marchandise", value: money(result.goodsFcfa) },
      { label: "Frais d'approche", value: money(result.feesFcfa) },
      { label: "Prix de revient total", value: money(result.totalCostFcfa) },
      { label: "Chiffre d'affaires prévu", value: money(result.revenueFcfa) },
      { label: "Marge sur le revient", value: rate(result.markupRate) },
      { label: "Marge sur le CA", value: rate(result.marginRate) },
      {
        color: result.marginFcfa < 0 ? COLORS.danger : undefined,
        emphasis: true,
        label: "Marge totale prévue",
        value: money(result.marginFcfa),
      },
    ]),
    ...notesBlock(simulation.notes),
  ];

  return documentFrame(
    {
      company,
      reference: simulation.name,
      subtitle: "Calcul prévisionnel",
      title: "SIMULATION D'IMPORT",
    },
    content,
  );
};

/** Reçu remis au client : ni coût ni marge, seulement ce qu'il achète et ce qu'il doit. */
export const saleReceiptDocument = (sale: SaleDetail, company: Company): TDocumentDefinitions => {
  const { summary } = sale;
  const activePayments = sale.payments.filter((payment) => !payment.cancelledAt);
  const content: Content[] = [
    {
      columnGap: 20,
      columns: [
        {
          stack: [
            { style: "label", text: "CLIENT" },
            {
              bold: true,
              fontSize: 11,
              margin: [0, 2, 0, 0],
              text: sale.customer.name,
            },
            ...[sale.customer.phone, sale.customer.address]
              .filter(Boolean)
              .map((line) => ({ color: COLORS.muted, text: line ?? "" })),
          ],
          width: "*",
        },
        infoGrid(
          [
            { label: "Date", value: formatDate(sale.saleDate) },
            { label: "Paiement", value: PAYMENT_TYPE_LABELS[sale.paymentType] },
          ],
          2,
        ),
      ],
      margin: [0, 0, 0, 10],
    },
    dataTable(
      [
        { header: "Désignation", width: "*" },
        { align: "right", header: "Quantité" },
        { align: "right", header: "Prix unitaire" },
        { align: "right", header: "Montant" },
      ],
      sale.items.map((item) => [
        item.productName,
        qty(item.qty, item.productUnit),
        money(item.unitPriceFcfa),
        { bold: true, text: money(item.amountFcfa) },
      ]),
    ),
    ...(sale.discounts.length > 0
      ? [
          sectionTitle("Remises accordées"),
          dataTable(
            [
              { header: "Date" },
              { header: "Motif", width: "*" },
              { align: "right", header: "Montant" },
            ],
            sale.discounts.map((discount) => [
              formatDate(discount.discountDate),
              discount.reason,
              `− ${money(discount.amountFcfa)}`,
            ]),
          ),
        ]
      : []),
    ...(activePayments.length > 0
      ? [
          sectionTitle("Paiements reçus"),
          dataTable(
            [
              { header: "Date" },
              { header: "Moyen", width: "*" },
              { align: "right", header: "Montant" },
            ],
            activePayments.map((payment) => [
              formatDate(payment.paymentDate),
              PAYMENT_METHOD_LABELS[payment.method],
              money(payment.amountFcfa),
            ]),
          ),
        ]
      : []),
    summaryBox([
      { label: "Total des articles", value: money(summary.totalFcfa) },
      ...(summary.discountFcfa > 0
        ? [{ label: "Remises", value: `− ${money(summary.discountFcfa)}` }]
        : []),
      { emphasis: true, label: "Net à payer", value: money(summary.netFcfa) },
      ...(sale.status === "active"
        ? [
            { label: "Payé", value: money(summary.paidFcfa) },
            {
              color: summary.dueFcfa > 0 ? COLORS.warning : COLORS.primary,
              label: "Reste dû",
              value: summary.dueFcfa > 0 ? money(summary.dueFcfa) : "Soldé",
            },
          ]
        : []),
    ]),
    ...(sale.status === "cancelled"
      ? [
          {
            bold: true,
            color: COLORS.danger,
            margin: [0, 16, 0, 0],
            text: pdfText(`Vente annulée : ${sale.cancelReason ?? ""}`),
          } as Content,
        ]
      : [
          {
            alignment: "center",
            color: COLORS.muted,
            italics: true,
            margin: [0, 28, 0, 0],
            text: "Merci de votre confiance.",
          } as Content,
        ]),
  ];

  return documentFrame(
    {
      company,
      reference: sale.reference,
      title: "REÇU DE VENTE",
      watermark: sale.status === "cancelled" ? "ANNULÉE" : undefined,
    },
    content,
  );
};

/** Fiche de commande fournisseur : lignes, frais (réels si reçue), prix de revient. */
export const purchaseOrderDocument = (
  order: PurchaseOrderDetail,
  company: Company,
): TDocumentDefinitions => {
  const received = order.status === "received";
  const showWeight = order.items.some((item) => item.weightTons);
  const estimateFreight = computeFeesFcfa(order).freightFcfa;
  const feeRows = received
    ? order.fees.map((fee) => [
        fee.label,
        feeDetail(fee),
        ALLOCATION_METHOD_LABELS[fee.allocationMethod],
        money(fee.amountFcfa),
      ])
    : [
        [
          `Fret maritime (${qty(order.freightCbm, "CBM")} × ${money(order.freightRatePerCbmFcfa)})`,
          "—",
          ALLOCATION_METHOD_LABELS[order.allocationMethod],
          money(estimateFreight),
        ],
        [
          "Transport local",
          "—",
          ALLOCATION_METHOD_LABELS[order.allocationMethod],
          money(order.localTransportFcfa),
        ],
        [
          "Autres frais",
          "—",
          ALLOCATION_METHOD_LABELS[order.allocationMethod],
          money(order.otherFeesFcfa),
        ],
      ];

  const content: Content[] = [
    infoGrid([
      { label: "Fournisseur", value: order.supplier?.name ?? "—" },
      { label: "Date de commande", value: formatDate(order.orderDate) },
      { label: "Statut", value: PURCHASE_ORDER_STATUS_LABELS[order.status] },
      { label: "Prix fournisseur", value: PURCHASE_CURRENCY_LABELS[order.currency] },
      { label: "Taux", value: formatOrderRates(order) },
      {
        label: "Arrivée au port",
        value: order.arrivedAt ? formatDate(order.arrivedAt) : null,
      },
      {
        label: "Entrée en stock",
        value: order.receivedAt ? formatDate(order.receivedAt) : null,
      },
      { label: "N° conteneur", value: order.containerNumber },
      { label: "N° BL", value: order.billOfLading },
      { label: "Transitaire", value: order.forwarder },
    ]),
    sectionTitle("Produits commandés"),
    dataTable(
      [
        { header: "Produit", width: "*" },
        { align: "right", header: received ? "Reçu / commandé" : "Quantité" },
        ...(showWeight ? [{ align: "right" as const, header: "Poids" }] : []),
        { align: "right", header: "Prix fournisseur" },
        { align: "right", header: "Marchandise" },
        { align: "right", header: "Part des frais" },
        { align: "right", header: "Revient unitaire" },
      ],
      order.items.map((item) => [
        item.productName,
        received && item.qtyReceived !== null
          ? `${qty(item.qtyReceived)} / ${qty(item.qty, item.productUnit)}`
          : qty(item.qty, item.productUnit),
        ...(showWeight ? [item.weightTons ? qty(item.weightTons, "T") : "—"] : []),
        `${pdfText(formatCurrency(item.unitPrice, order.currency))}${item.pricingBasis === "weight" ? " / T" : ""}`,
        money(item.goodsFcfa),
        money(item.transportShareFcfa),
        { bold: true, text: money(item.unitCostFcfa) },
      ]),
      [
        "Total",
        "",
        ...(showWeight
          ? [order.costs.totalWeightTons > 0 ? qty(order.costs.totalWeightTons, "T") : ""]
          : []),
        pdfText(formatCurrency(order.costs.goodsAmount, order.currency)),
        money(order.costs.goodsFcfa),
        money(order.costs.feesFcfa),
        money(order.costs.totalFcfa),
      ],
    ),
    sectionTitle(received ? "Frais réels" : "Frais estimés"),
    dataTable(
      [
        { header: "Frais", width: "*" },
        { align: "right", header: "Montant d'origine" },
        { header: "Répartition" },
        { align: "right", header: "En FCFA" },
      ],
      feeRows,
      ["Total des frais", "", "", money(order.costs.feesFcfa)],
    ),
    summaryBox([
      { label: "Marchandise", value: money(order.costs.goodsFcfa) },
      ...(order.currency === "usd"
        ? []
        : [{ label: "Soit en dollars", value: pdfText(formatUsd(order.costs.goodsUsd)) }]),
      { label: "Frais d'approche", value: money(order.costs.feesFcfa) },
      ...(received
        ? [
            {
              label: "Estimé à la commande",
              value: money(order.estimate.totalFcfa),
            },
          ]
        : []),
      {
        emphasis: true,
        label: received ? "Prix de revient réel" : "Prix de revient estimé",
        value: money(order.costs.totalFcfa),
      },
    ]),
    ...notesBlock(order.notes),
  ];

  return documentFrame(
    {
      company,
      reference: order.reference,
      subtitle: received ? "Coûts réels de réception" : "Estimation",
      title: "COMMANDE FOURNISSEUR",
    },
    content,
  );
};

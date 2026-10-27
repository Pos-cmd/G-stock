import { formatDate, formatDateTime, formatQty } from "@G-stock/core/format";
import { PAYMENT_METHOD_LABELS, PAYMENT_TYPE_LABELS } from "@G-stock/core/labels";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";

import type { getSale } from "../services/sales";
import type { Company } from "./theme";
import { COLORS, money, pdfText } from "./theme";

type SaleDetail = Awaited<ReturnType<typeof getSale>>;

/** Largeur d'un écran de téléphone (≈ 10,5 cm) : le reçu se lit sans zoomer dans WhatsApp. */
const PAGE_WIDTH = 300;
const MARGIN = 18;
const LINE_WIDTH = PAGE_WIDTH - 2 * MARGIN;

const separator = (margin: [number, number, number, number] = [0, 8, 0, 8]): Content => ({
  canvas: [
    {
      lineColor: COLORS.border,
      lineWidth: 0.75,
      type: "line",
      x1: 0,
      x2: LINE_WIDTH,
      y1: 0,
      y2: 0,
    },
  ],
  margin,
});

interface AmountRow {
  label: string;
  value: string;
  bold?: boolean;
  color?: string;
  fontSize?: number;
}

const amountRow = ({ label, value, bold = false, color, fontSize }: AmountRow): Content => ({
  columns: [
    { bold, color, fontSize, text: label, width: "*" },
    { alignment: "right", bold, color, fontSize, text: value, width: "auto" },
  ],
  margin: [0, 2, 0, 2],
});

const itemBlock = (item: SaleDetail["items"][number]): Content => ({
  margin: [0, 0, 0, 7],
  stack: [
    { bold: true, text: item.productName },
    {
      color: COLORS.muted,
      columns: [
        {
          text: pdfText(`${formatQty(item.qty, item.productUnit)} × ${money(item.unitPriceFcfa)}`),
          width: "*",
        },
        {
          alignment: "right",
          bold: true,
          color: COLORS.text,
          text: money(item.amountFcfa),
          width: "auto",
        },
      ],
      margin: [0, 1, 0, 0],
    },
  ],
});

/**
 * Reçu au format téléphone : une seule page étroite, aussi longue que nécessaire, en gros
 * caractères. Conçu pour être envoyé au client sur WhatsApp ; le reçu A4 reste pour l'impression.
 */
export const saleReceiptMobileDocument = (
  sale: SaleDetail,
  company: Company,
): TDocumentDefinitions => {
  const { summary } = sale;
  const isActive = sale.status === "active";
  const activePayments = sale.payments.filter((payment) => !payment.cancelledAt);
  const companyLines = [company.companyPhone, company.companyAddress].filter(Boolean);

  const content: Content[] = [
    {
      bold: true,
      color: COLORS.primary,
      fontSize: 15,
      text: company.companyName || "G-stock",
    },
    ...companyLines.map((line): Content => ({
      color: COLORS.muted,
      fontSize: 9,
      text: line,
    })),
    separator([0, 8, 0, 10]),
    {
      columns: [
        { bold: true, fontSize: 12, text: "REÇU", width: "*" },
        {
          alignment: "right",
          bold: true,
          color: COLORS.primary,
          fontSize: 12,
          text: sale.reference,
          width: "auto",
        },
      ],
    },
    {
      color: COLORS.muted,
      margin: [0, 2, 0, 0],
      text: pdfText(`${formatDate(sale.saleDate)} · ${PAYMENT_TYPE_LABELS[sale.paymentType]}`),
    },
    {
      margin: [0, 8, 0, 0],
      stack: [
        { color: COLORS.muted, fontSize: 8, text: "CLIENT" },
        { bold: true, text: sale.customer.name },
        ...(sale.customer.phone
          ? [{ color: COLORS.muted, text: sale.customer.phone } as Content]
          : []),
      ],
    },
    separator([0, 10, 0, 10]),
    ...sale.items.map(itemBlock),
    separator([0, 2, 0, 6]),
    ...(summary.discountFcfa > 0
      ? [
          amountRow({
            label: "Total des articles",
            value: money(summary.totalFcfa),
          }),
          amountRow({
            label: "Remises",
            value: `− ${money(summary.discountFcfa)}`,
          }),
        ]
      : []),
    amountRow({
      bold: true,
      color: COLORS.primary,
      fontSize: 13,
      label: "Net à payer",
      value: money(summary.netFcfa),
    }),
    ...(isActive
      ? [
          amountRow({ label: "Payé", value: money(summary.paidFcfa) }),
          amountRow({
            bold: true,
            color: summary.dueFcfa > 0 ? COLORS.warning : COLORS.primary,
            label: "Reste dû",
            value: summary.dueFcfa > 0 ? money(summary.dueFcfa) : "Soldé",
          }),
        ]
      : []),
    ...(isActive && activePayments.length > 0
      ? [
          {
            color: COLORS.muted,
            fontSize: 8,
            margin: [0, 10, 0, 2],
            text: "PAIEMENTS REÇUS",
          } as Content,
          ...activePayments.map((payment): Content => ({
            columns: [
              {
                color: COLORS.muted,
                text: pdfText(
                  `${formatDate(payment.paymentDate)} · ${PAYMENT_METHOD_LABELS[payment.method]}`,
                ),
                width: "*",
              },
              {
                alignment: "right",
                text: money(payment.amountFcfa),
                width: "auto",
              },
            ],
            fontSize: 9,
            margin: [0, 1, 0, 1],
          })),
        ]
      : []),
    ...(isActive
      ? [
          {
            alignment: "center",
            color: COLORS.muted,
            italics: true,
            margin: [0, 16, 0, 0],
            text: "Merci de votre confiance.",
          } as Content,
        ]
      : [
          {
            bold: true,
            color: COLORS.danger,
            fontSize: 12,
            margin: [0, 14, 0, 0],
            text: pdfText(`VENTE ANNULÉE${sale.cancelReason ? ` : ${sale.cancelReason}` : ""}`),
          } as Content,
        ]),
    {
      alignment: "center",
      color: COLORS.muted,
      fontSize: 7,
      margin: [0, 10, 0, 0],
      text: pdfText(`Généré par G-stock le ${formatDateTime(new Date())}`),
    },
  ];

  return {
    content,
    defaultStyle: {
      color: COLORS.text,
      font: "Roboto",
      fontSize: 10,
      lineHeight: 1.2,
    },
    info: { creator: "G-stock", title: `Reçu ${sale.reference}` },
    pageMargins: [MARGIN, MARGIN, MARGIN, MARGIN],
    pageSize: { height: "auto", width: PAGE_WIDTH },
  };
};

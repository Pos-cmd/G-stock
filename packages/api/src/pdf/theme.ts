import { formatDateTime, formatFcfa } from "@G-stock/core/format";
import type {
  Content,
  ContentTable,
  CustomTableLayout,
  TDocumentDefinitions,
} from "pdfmake/interfaces";

/** Charte des documents G-stock : vert de l'application, gris ardoise, zébrures légères. */
export const COLORS = {
  border: "#d1d5db",
  danger: "#b91c1c",
  muted: "#64748b",
  primary: "#047857",
  primaryLight: "#ecfdf5",
  stripe: "#f8fafc",
  text: "#1e293b",
  warning: "#b45309",
} as const;

const PAGE_MARGINS: [number, number, number, number] = [40, 110, 40, 60];

/** L'espace fine insécable de fr-FR n'existe pas dans toutes les polices : espace insécable. */
export const pdfText = (value: string): string => value.replaceAll(" ", " ");

export const money = (amount: number): string => pdfText(formatFcfa(amount));

export interface Company {
  companyName: string;
  companyPhone: string;
  companyAddress: string;
}

export interface DocumentFrame {
  company: Company;
  /** Ex. : « REÇU DE VENTE ». */
  title: string;
  reference?: string;
  subtitle?: string;
  generatedAt?: Date;
  /** Filigrane, ex. « ANNULÉE ». */
  watermark?: string;
}

/** En-tête (entreprise + titre), pied de page numéroté et styles communs. */
export const documentFrame = (frame: DocumentFrame, content: Content[]): TDocumentDefinitions => {
  const generatedAt = frame.generatedAt ?? new Date();
  const companyLines = [frame.company.companyPhone, frame.company.companyAddress].filter(Boolean);
  return {
    content,
    defaultStyle: {
      color: COLORS.text,
      font: "Roboto",
      fontSize: 9,
      lineHeight: 1.2,
    },
    footer: (currentPage, pageCount) => ({
      columns: [
        {
          color: COLORS.muted,
          fontSize: 7.5,
          text: pdfText(`Document généré par G-stock le ${formatDateTime(generatedAt)}`),
        },
        {
          alignment: "right",
          color: COLORS.muted,
          fontSize: 7.5,
          text: `Page ${currentPage} / ${pageCount}`,
        },
      ],
      margin: [40, 20, 40, 0],
    }),
    header: () => ({
      margin: [40, 30, 40, 0],
      stack: [
        {
          columns: [
            {
              stack: [
                {
                  bold: true,
                  color: COLORS.primary,
                  fontSize: 16,
                  text: frame.company.companyName || "G-stock",
                },
                ...companyLines.map((line) => ({
                  color: COLORS.muted,
                  fontSize: 8.5,
                  text: line,
                })),
              ],
              width: "*",
            },
            {
              alignment: "right",
              stack: [
                {
                  bold: true,
                  characterSpacing: 0.5,
                  fontSize: 13,
                  text: frame.title,
                },
                ...(frame.reference
                  ? [
                      {
                        bold: true,
                        color: COLORS.primary,
                        fontSize: 10,
                        text: frame.reference,
                      },
                    ]
                  : []),
                ...(frame.subtitle
                  ? [
                      {
                        color: COLORS.muted,
                        fontSize: 8.5,
                        text: pdfText(frame.subtitle),
                      },
                    ]
                  : []),
              ],
              width: "auto",
            },
          ],
        },
        {
          canvas: [
            {
              lineColor: COLORS.primary,
              lineWidth: 1.5,
              type: "line",
              x1: 0,
              x2: 515,
              y1: 8,
              y2: 8,
            },
          ],
        },
      ],
    }),
    info: {
      creator: "G-stock",
      title: `${frame.title} ${frame.reference ?? ""}`.trim(),
    },
    pageMargins: PAGE_MARGINS,
    pageSize: "A4",
    styles: {
      label: { color: COLORS.muted, fontSize: 7.5 },
      sectionTitle: {
        bold: true,
        color: COLORS.primary,
        fontSize: 11,
        margin: [0, 14, 0, 6],
      },
      tableHeader: {
        bold: true,
        color: "#ffffff",
        fillColor: COLORS.primary,
        fontSize: 8.5,
      },
    },
    ...(frame.watermark
      ? {
          watermark: {
            bold: true,
            color: COLORS.danger,
            opacity: 0.12,
            text: frame.watermark,
          },
        }
      : {}),
  };
};

export const sectionTitle = (text: string): Content => ({
  style: "sectionTitle",
  text,
});

/** Grille d'informations : libellé gris au-dessus de la valeur, sur plusieurs colonnes. */
export const infoGrid = (
  items: readonly { label: string; value: string | null | undefined }[],
  columns = 3,
): Content => {
  const filled = items.filter((item) => item.value);
  const rows: Content[] = [];
  for (let start = 0; start < filled.length; start += columns) {
    const slice = filled.slice(start, start + columns);
    rows.push({
      columnGap: 16,
      columns: [
        ...slice.map((item) => ({
          stack: [
            { style: "label", text: item.label.toUpperCase() },
            { margin: [0, 1, 0, 0], text: pdfText(item.value ?? "") },
          ],
          width: "*",
        })),
        ...Array.from({ length: columns - slice.length }, () => ({
          text: "",
          width: "*",
        })),
      ],
      margin: [0, 0, 0, 8],
    } as Content);
  }
  return { stack: rows };
};

const zebraLayout: CustomTableLayout = {
  fillColor: (rowIndex) => (rowIndex > 0 && rowIndex % 2 === 0 ? COLORS.stripe : null),
  hLineColor: () => COLORS.border,
  hLineWidth: (index, node) => (index === 0 || index === node.table.body.length ? 0 : 0.5),
  paddingBottom: () => 5,
  paddingLeft: () => 6,
  paddingRight: () => 6,
  paddingTop: () => 5,
  vLineWidth: () => 0,
};

export interface Column {
  header: string;
  width?: number | "*" | "auto";
  align?: "left" | "right" | "center";
}

/** Tableau à en-tête coloré et lignes zébrées ; `footer` ajoute une ligne de total en gras. */
/** Cellule : texte simple, ou texte mis en forme (gras, couleur). */
export type CellValue = string | { text: string; bold?: boolean; color?: string };

export const dataTable = (
  columns: readonly Column[],
  rows: readonly (readonly CellValue[])[],
  footer?: readonly CellValue[],
): ContentTable => {
  const cell = (value: CellValue, index: number) => {
    const alignment = columns[index]?.align ?? "left";
    return typeof value === "string"
      ? { alignment, text: pdfText(value) }
      : { ...value, alignment, text: pdfText(value.text) };
  };
  return {
    layout: zebraLayout,
    table: {
      body: [
        columns.map((column) => ({
          alignment: column.align ?? "left",
          style: "tableHeader",
          text: column.header,
        })),
        ...rows.map((row) => row.map(cell)),
        ...(footer
          ? [
              footer.map((value, index) => ({
                ...cell(value, index),
                bold: true,
                fillColor: COLORS.primaryLight,
              })),
            ]
          : []),
      ],
      dontBreakRows: true,
      headerRows: 1,
      widths: columns.map((column) => column.width ?? "auto"),
    },
  };
};

/** Encadré de résumé final : lignes libellé / montant, la dernière mise en valeur. */
export const summaryBox = (
  rows: readonly {
    label: string;
    value: string;
    emphasis?: boolean;
    color?: string;
  }[],
): Content => ({
  columns: [
    { text: "", width: "*" },
    {
      layout: {
        fillColor: () => COLORS.primaryLight,
        hLineColor: () => COLORS.primary,
        hLineWidth: (index, node) => (index === 0 || index === node.table.body.length ? 1 : 0),
        paddingBottom: () => 4,
        paddingLeft: () => 10,
        paddingRight: () => 10,
        paddingTop: () => 4,
        vLineColor: () => COLORS.primary,
        vLineWidth: (index, node) => (index === 0 || index === node.table.widths?.length ? 1 : 0),
      },
      table: {
        body: rows.map((row) => [
          {
            bold: row.emphasis,
            color: row.emphasis ? COLORS.primary : COLORS.muted,
            text: row.label,
          },
          {
            alignment: "right",
            bold: true,
            color: row.color ?? (row.emphasis ? COLORS.primary : COLORS.text),
            fontSize: row.emphasis ? 12 : 9,
            text: pdfText(row.value),
          },
        ]),
        widths: [150, 110],
      },
      width: "auto",
    },
  ],
  margin: [0, 14, 0, 0],
  unbreakable: true,
});

export const notesBlock = (notes: string | null | undefined): Content[] =>
  notes ? [sectionTitle("Notes"), { color: COLORS.muted, text: pdfText(notes) }] : [];

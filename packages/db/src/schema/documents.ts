import { DOCUMENT_TYPES } from "@G-stock/core/enums";
import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { createdAt, id, ref } from "../columns";

/** PDF générés, rangés dans un dossier local ; `reference_*` pointe vers la vente, la commande… */
export const documents = sqliteTable(
  "documents",
  {
    id: id(),
    type: text("type", { enum: DOCUMENT_TYPES }).notNull(),
    title: text("title").notNull(),
    referenceType: text("reference_type"),
    referenceId: ref("reference_id"),
    filePath: text("file_path").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index("documents_reference_idx").on(table.referenceType, table.referenceId),
    index("documents_type_idx").on(table.type),
  ],
);

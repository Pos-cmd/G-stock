import { protectedProcedure } from "../index";
import { documentGenerateSchema, documentListSchema } from "../schemas/documents";
import { generateDocument, listDocuments } from "../services/documents";

export const documentsRouter = {
  generate: protectedProcedure
    .input(documentGenerateSchema)
    .handler(({ context, input }) => generateDocument(context.db, input)),

  list: protectedProcedure
    .input(documentListSchema)
    .handler(({ context, input }) => listDocuments(context.db, input)),
};

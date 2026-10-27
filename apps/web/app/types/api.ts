import type { AppRouter } from "@G-stock/api/routers/index";
import type { InferRouterOutputs } from "@orpc/server";

type Outputs = InferRouterOutputs<AppRouter>;

export type ProductRow = Outputs["products"]["list"][number];
export type ProductDetail = Outputs["products"]["get"];
export type StockLot = Outputs["stock"]["lots"]["list"][number];
export type StockMovementRow = Outputs["stock"]["movements"]["list"]["items"][number];

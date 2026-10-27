import type { AppRouter } from "@G-stock/api/routers/index";
import type { InferRouterOutputs } from "@orpc/server";

type Outputs = InferRouterOutputs<AppRouter>;

export type ProductRow = Outputs["products"]["list"][number];
export type ProductDetail = Outputs["products"]["get"];
export type StockLot = Outputs["stock"]["lots"]["list"][number];
export type StockMovementRow = Outputs["stock"]["movements"]["list"]["items"][number];
export type SupplierRow = Outputs["suppliers"]["list"][number];
export type PurchaseOrderRow = Outputs["purchases"]["list"][number];
export type PurchaseOrderDetail = Outputs["purchases"]["get"];
export type PurchaseOrderItemRow = PurchaseOrderDetail["items"][number];

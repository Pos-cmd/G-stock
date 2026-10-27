import { appRouter } from "@G-stock/api/routers/index";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { BatchHandlerPlugin } from "@orpc/server/plugins";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";

import { createContext } from "../../../src/context";

const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
  plugins: [new BatchHandlerPlugin()],
});

const apiHandler = new OpenAPIHandler(appRouter, {
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
    }),
  ],
});

export default defineEventHandler(async (event) => {
  await ensureDatabaseReady();
  const request = toWebRequest(event);
  const context = await createContext({
    headers: request.headers,
  });

  const rpcResult = await rpcHandler.handle(request, {
    context,
    prefix: "/rpc",
  });
  if (rpcResult.response) {
    return rpcResult.response;
  }

  const apiResult = await apiHandler.handle(request, {
    context,
    prefix: "/rpc/api-reference",
  });
  if (apiResult.response) {
    return apiResult.response;
  }

  setResponseStatus(event, 404, "Not Found");
  return "Not found";
});

import { appRouter } from "@G-stock/api/routers/index";
import { createRouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";

import { createContext } from "../../src/context";

// During server rendering, call the router directly instead of over HTTP.
// The context comes from the incoming request, so the user's session applies.
export default defineNuxtPlugin(() => {
  const event = useRequestEvent();

  if (!event) {
    throw new Error("Missing Nuxt request event");
  }

  // Composables must run during plugin setup, so read the request headers here.
  const headers = useRequestHeaders();

  const client = createRouterClient(appRouter, {
    context: () =>
      createContext({
        headers: new Headers(headers),
      }),
  });
  const orpc = createTanstackQueryUtils(client);

  return {
    provide: {
      orpc,
    },
  };
});

import { createAuthClient } from "better-auth/vue";

export default defineNuxtPlugin(() => {
  const authClient = createAuthClient({
    fetchOptions: {
      headers: import.meta.server ? useRequestHeaders(["cookie"]) : undefined,
    },
    baseURL: useRequestURL().origin,
  });

  return {
    provide: {
      authClient: authClient,
    },
  };
});

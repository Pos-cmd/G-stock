const PUBLIC_ROUTES = new Set(["/login"]);

export default defineNuxtRouteMiddleware(async (to) => {
  if (PUBLIC_ROUTES.has(to.path)) {
    return;
  }
  const { data: session } = await useAuthSession();
  if (!session.value) {
    return navigateTo("/login");
  }
});

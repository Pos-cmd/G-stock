// Lance les migrations dès le démarrage plutôt qu'à la première requête.
export default defineNitroPlugin(async () => {
  await ensureDatabaseReady();
});

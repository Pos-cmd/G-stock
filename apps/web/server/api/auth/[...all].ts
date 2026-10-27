import { auth } from "../../../src/services";

export default defineEventHandler(async (event) => {
  await ensureDatabaseReady();
  return auth.handler(toWebRequest(event));
});

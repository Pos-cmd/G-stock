import { auth } from "../../../src/services";

export default defineEventHandler(async (event) => {
  return auth.handler(toWebRequest(event));
});

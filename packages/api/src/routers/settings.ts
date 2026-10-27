import { protectedProcedure } from "../index";
import { appSettingsSchema } from "../schemas/settings";
import { getSettings, updateSettings } from "../services/settings";

export const settingsRouter = {
  get: protectedProcedure.handler(({ context }) => getSettings(context.db)),

  update: protectedProcedure
    .input(appSettingsSchema)
    .handler(({ context, input }) => updateSettings(context.db, input)),
};

import { protectedProcedure } from "../index";
import { backupNow, getBackupStatus } from "../services/backups";

export const backupsRouter = {
  create: protectedProcedure.handler(({ context }) => backupNow(context.db)),

  status: protectedProcedure.handler(({ context }) => getBackupStatus(context.db)),
};

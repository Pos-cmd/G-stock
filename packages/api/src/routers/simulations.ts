import { protectedProcedure } from "../index";
import { byIdSchema } from "../schemas/common";
import { simulationInputSchema, simulationUpdateSchema } from "../schemas/simulations";
import {
  convertSimulationToOrder,
  createSimulation,
  duplicateSimulation,
  getSimulation,
  listSimulations,
  removeSimulation,
  updateSimulation,
} from "../services/simulations";

export const simulationsRouter = {
  convertToOrder: protectedProcedure
    .input(byIdSchema)
    .handler(({ context, input }) =>
      context.db.transaction((tx) => convertSimulationToOrder(tx, input.id)),
    ),

  create: protectedProcedure
    .input(simulationInputSchema)
    .handler(({ context, input }) => createSimulation(context.db, input, context.session.user.id)),

  duplicate: protectedProcedure
    .input(byIdSchema)
    .handler(({ context, input }) =>
      duplicateSimulation(context.db, input.id, context.session.user.id),
    ),

  get: protectedProcedure
    .input(byIdSchema)
    .handler(({ context, input }) => getSimulation(context.db, input.id)),

  list: protectedProcedure.handler(({ context }) => listSimulations(context.db)),

  remove: protectedProcedure
    .input(byIdSchema)
    .handler(({ context, input }) => removeSimulation(context.db, input.id)),

  update: protectedProcedure
    .input(simulationUpdateSchema)
    .handler(({ context, input: { id, ...data } }) => updateSimulation(context.db, id, data)),
};

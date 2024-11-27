import { z } from "zod";

export const eventParamsSchema = z.object({
  deviceId: z.number().or(z.literal("all")),
  type: z.enum(["deviceOverspeed"]),
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export const dateTimeParamsSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

import { z } from "zod";
export const dateTimeParamsSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

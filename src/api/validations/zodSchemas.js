import { z } from "zod";

const stringNumber = z.string().refine((value) => /^\d+$/.test(value), {
  message: "Invalid number",
});

export const dateTimeParamsSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export const corpParamsSchema = z.object({
  contractorId: z.union([stringNumber, z.number()]).optional(),
  companyId: z.union([stringNumber, z.number()]).optional(),
  contractId: z.union([stringNumber, z.number()]).optional(),
});

export const summaryQuerySchema = dateTimeParamsSchema
  .merge(corpParamsSchema)
  .extend({
    userId: z.union([stringNumber, z.number()]).optional(),
  });

// Error Parsing
const formatZodIssue = (issue) => {
  const { path, message } = issue;
  const pathString = path.join(".");

  return `${pathString}: ${message}`;
};

// Format the Zod error message with only the current error
export const formatZodError = (error) => {
  const { issues } = error;

  if (issues.length) {
    const currentIssue = issues[0];

    return formatZodIssue(currentIssue);
  }
};

const ZodNumber = z.union([stringNumber, z.number()]).optional();

export const binsSchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    empted: z.string().optional(),
    q: z.string().optional(),
    count: z.string().optional(),
    limit: ZodNumber,
    cursor: ZodNumber,
    contractId: ZodNumber,
    contractorId: ZodNumber,
    companyId: ZodNumber,
    routeid: ZodNumber,
    typeid: ZodNumber,
    tagid: ZodNumber,
    binId: ZodNumber,
    userId: ZodNumber,
    by: z.string().optional(),
    deviceId: ZodNumber,
    get: z.string().or(z.array(z.string())).optional(),
  })
  .superRefine((data, ctx) => {
    const { from, to, empted } = data;

    // Rule 1: Both "from" and "to" are required when "empted" is specified
    if (empted !== undefined) {
      if (!from || !to) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '"from" and "to" are required when "empted" is specified',
        });
      }
    }

    // Rule 2: "from" and "to" can only be used when "empted" is present
    if ((from || to) && empted === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '"from" and "to" can only be used when "empted" is specified',
      });
    }
  });

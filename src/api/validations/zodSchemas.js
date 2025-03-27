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

import { z } from "zod";
const amount = z.number().int().min(1).max(999_999_999_99);
const validDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) =>
      !Number.isNaN(Date.parse(s)) &&
      new Date(s).toISOString().slice(0, 10) === s,
    "Enter a valid date.",
  );
const company = z.enum(["akar", "mastura", "trust", "amiza", "kugiran"]);
export const jobSchema = z.object({
  companyId: company,
  workType: z.string().trim().min(1).max(160),
  client: z.string().trim().min(1).max(160),
  price: amount,
  location: z.string().trim().min(2).max(500),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  date: validDate,
  description: z.string().max(5000),
  status: z.enum(["Active", "Completed", "On hold"]),
});
export const expenseSchema = z.object({
  jobId: z.string().min(1),
  description: z.string().trim().min(1).max(500),
  category: z.string().min(1),
  amount,
  date: validDate,
});
export const overheadSchema = z.object({
  companyId: z.enum(["akar", "mastura", "trust", "amiza", "kugiran", "shared"]),
  description: z.string().trim().min(1).max(500),
  category: z.string().min(1),
  amount,
  date: validDate,
  recurring: z.boolean(),
  frequency: z.enum(["monthly", "yearly"]),
});

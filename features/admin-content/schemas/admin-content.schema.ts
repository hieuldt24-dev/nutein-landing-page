import { z } from "zod";
import { POLICY_SLUGS } from "@/features/policies/types";

export const adminStaticSlugSchema = z.enum([...POLICY_SLUGS, "about"]);

export const adminContentUpdateSchema = z.object({
  title: z.string().trim().min(1, "Tiêu đề bắt buộc.").optional(),
  content: z.string().trim().min(1, "Nội dung bắt buộc.").optional(),
});

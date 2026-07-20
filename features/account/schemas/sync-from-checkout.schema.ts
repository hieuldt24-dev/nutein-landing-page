import { z } from "zod";

/**
 * Payload sync từ checkout khi `saveInfo` + order success + logged in.
 * Khớp shape buyer/address của checkout schema.
 */
export const syncFromCheckoutSchema = z.object({
  buyer: z.object({
    fullName: z.string().trim().min(2),
    phone: z.string().trim().min(1),
    email: z.string().trim().email(),
  }),
  address: z.object({
    provinceCode: z.string().trim().min(1),
    province: z.string().trim().min(1),
    wardCode: z.string().trim().min(1),
    ward: z.string().trim().min(1),
    street: z.string().trim().min(1),
  }),
});

export type SyncFromCheckoutInput = z.infer<typeof syncFromCheckoutSchema>;

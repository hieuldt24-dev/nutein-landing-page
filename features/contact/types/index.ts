/**
 * TypeScript types riêng cho feature Contact.
 * Import các types này trong service, component của feature này.
 */

import type { ContactFormData } from "../schemas/contact.schema";

export type { ContactFormData };

/** Kết quả sau khi xử lý form liên hệ */
export interface ContactSubmissionResult {
  id: string;
  submittedAt: Date;
  message: string;
}

/** Trạng thái của form liên hệ ở phía client */
export type ContactFormStatus = "idle" | "submitting" | "success" | "error";

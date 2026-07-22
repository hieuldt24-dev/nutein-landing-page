import "server-only";

import { logger } from "@/src/logging/logger";
import { EXPECTED_RESPONSE_TIME_HOURS } from "../constants";
import type { ContactFormData, ContactSubmissionResult } from "../types";
import { contactRepository } from "./contact.repository";

/**
 * contactService — lưu form liên hệ vào `contact_messages`.
 * Email/CRM: chưa wire (TODO sau).
 */
export const contactService = {
  async submit(data: ContactFormData): Promise<ContactSubmissionResult> {
    const serviceLogger = logger.child({
      service: "contactService",
      action: "submit",
    });
    serviceLogger.info({ email: data.email }, "Processing contact form submission");

    const row = await contactRepository.create(data);

    const result: ContactSubmissionResult = {
      id: row.id,
      submittedAt: new Date(row.created_at),
      message: `Cảm ơn bạn đã liên hệ! Chúng tôi sẽ phản hồi trong vòng ${EXPECTED_RESPONSE_TIME_HOURS} giờ.`,
    };

    serviceLogger.info(
      { id: result.id, email: data.email },
      "Contact form submitted successfully",
    );

    return result;
  },
};

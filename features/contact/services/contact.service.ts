import "server-only";
import { logger } from "@/src/logging/logger";
import type { ContactFormData, ContactSubmissionResult } from "../types";

/**
 * contactService - Logic nghiệp vụ xử lý form liên hệ.
 *
 * Đây là nơi thực thi:
 * - Lưu dữ liệu vào database
 * - Gửi email notification
 * - Tích hợp CRM
 */
export const contactService = {
  /**
   * Xử lý và lưu thông tin liên hệ từ form.
   *
   * @param data - Dữ liệu đã được validate bởi contactFormSchema
   * @returns Kết quả sau khi tạo thành công
   */
  async submit(data: ContactFormData): Promise<ContactSubmissionResult> {
    const serviceLogger = logger.child({ service: "contactService", action: "submit" });
    serviceLogger.info({ email: data.email }, "Processing contact form submission");

    // TODO: Thay thế bằng logic thực tế:
    // - await db.contactSubmissions.create({ data })
    // - await emailService.sendNotification({ to: "admin@nutein.com", ...data })

    // Placeholder logic
    await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate async work

    const result: ContactSubmissionResult = {
      id: crypto.randomUUID(),
      submittedAt: new Date(),
      message: "Cảm ơn bạn đã liên hệ! Chúng tôi sẽ phản hồi trong vòng 24 giờ.",
    };

    serviceLogger.info({ id: result.id, email: data.email }, "Contact form submitted successfully");

    return result;
  },
};

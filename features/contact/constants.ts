/**
 * Hằng số nghiệp vụ của feature Contact.
 */

/** Danh sách chủ đề liên hệ hiển thị trong dropdown */
export const CONTACT_SUBJECTS = [
  { label: "Tư vấn sản phẩm", value: "product_inquiry" },
  { label: "Hỗ trợ kỹ thuật", value: "technical_support" },
  { label: "Hợp tác kinh doanh", value: "business_partnership" },
  { label: "Phản hồi & Góp ý", value: "feedback" },
  { label: "Khác", value: "other" },
] as const;

export type ContactSubject = (typeof CONTACT_SUBJECTS)[number]["value"];

/** Thời gian phản hồi mong đợi (giờ) */
export const EXPECTED_RESPONSE_TIME_HOURS = 24;

/** Giới hạn số ký tự tối đa cho message */
export const MAX_MESSAGE_LENGTH = 1000;

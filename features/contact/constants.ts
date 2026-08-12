/**
 * Hằng số nghiệp vụ của feature Contact.
 */

/** Danh sách chủ đề liên hệ hiển thị trong dropdown */
export const CONTACT_SUBJECTS = [
  { label: "Tư vấn sản phẩm", value: "product_inquiry" },
  { label: "Hỗ trợ đơn hàng", value: "order_support" },
  { label: "Hợp tác kinh doanh", value: "business_partnership" },
  { label: "Phản hồi & Góp ý", value: "feedback" },
  { label: "Khác", value: "other" },
] as const;

export type ContactSubject = (typeof CONTACT_SUBJECTS)[number]["value"];

/** Thời gian phản hồi mong đợi (giờ) */
export const EXPECTED_RESPONSE_TIME_HOURS = 24;

/** Giới hạn số ký tự tối đa cho message */
export const MAX_MESSAGE_LENGTH = 1000;

export const CONTACT_PAGE_META = {
  title: "Liên hệ | Nutein",
  description:
    "Liên hệ Nutein — hotline, email và form gửi tin nhắn. Chúng tôi sẵn sàng hỗ trợ lối sống lành mạnh của bạn.",
} as const;

/** Thông tin hiển thị cột trái (Joy Rush contact info). */
export const CONTACT_INFO = {
  email: "hhs.business.vn@gmail.com",
  hotline: "0353570977",
  hotlineHref: "tel:0353570977",
  emailHref: "mailto:hhs.business.vn@gmail.com",
  socials: [
    { label: "Fanpage", href: "#" },
    { label: "TikTok", href: "#" },
    { label: "Shopee", href: "#" },
  ],
} as const;

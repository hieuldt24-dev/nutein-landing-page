import type { AdminContactMessage } from "../types";

export const MOCK_ADMIN_CONTACTS: AdminContactMessage[] = [
  {
    id: "ct-1",
    name: "Ngô Bảo Châu",
    email: "baochau@example.com",
    phone: "0901111222",
    message: "Cho mình hỏi combo 6 hộp còn voucher không ạ?",
    isRead: false,
    isHandled: false,
    createdAt: "2026-07-21T01:00:00.000Z",
  },
  {
    id: "ct-2",
    name: "Đặng Thu Trang",
    email: "thutrang@example.com",
    message: "Muốn đổi địa chỉ giao cho đơn NT-20260720-B200.",
    isRead: true,
    isHandled: false,
    internalNote: "Đã gọi — chờ khách confirm ward mới",
    createdAt: "2026-07-20T09:00:00.000Z",
  },
  {
    id: "ct-3",
    name: "Vũ Minh Quân",
    email: "minhquan@example.com",
    phone: "0912333444",
    message: "Cảm ơn shop, mình nhận đủ hàng rồi.",
    isRead: true,
    isHandled: true,
    internalNote: "Feedback tích cực — đóng ticket",
    createdAt: "2026-07-18T15:00:00.000Z",
  },
];

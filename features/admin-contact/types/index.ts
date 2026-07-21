export interface AdminContactMessage {
  id: string;
  name: string;
  email: string;
  phone?: string;
  message: string;
  isRead: boolean;
  isHandled: boolean;
  internalNote?: string;
  createdAt: string;
}

export type AdminContactFilter = "all" | "unread" | "open" | "handled";

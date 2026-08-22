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

export interface AdminContactListQuery {
  filter?: AdminContactFilter;
  limit?: number;
  offset?: number;
}

export interface AdminContactListResult {
  items: AdminContactMessage[];
  total: number;
}

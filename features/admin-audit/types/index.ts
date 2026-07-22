export type AdminAuditAction = "CREATE" | "UPDATE" | "DELETE";

export interface AdminAuditEntry {
  id: string;
  action: AdminAuditAction;
  tableName: string;
  recordId: string;
  actorEmail: string;
  summary: string;
  createdAt: string;
}

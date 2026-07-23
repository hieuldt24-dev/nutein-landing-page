import type { AdminManagedUser } from "../types";

export const MOCK_ADMIN_USERS: AdminManagedUser[] = [
  {
    id: "u-admin",
    email: "admin@nutein.com",
    fullName: "Nutein Admin",
    role: "admin",
    locked: false,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "u-staff",
    email: "staff@nutein.com",
    fullName: "Nutein Staff",
    role: "staff",
    locked: false,
    createdAt: "2026-01-02T00:00:00.000Z",
  },
  {
    id: "u-1",
    email: "minhanh@example.com",
    fullName: "Nguyễn Minh Anh",
    role: "user",
    locked: false,
    createdAt: "2026-06-10T00:00:00.000Z",
  },
  {
    id: "u-2",
    email: "quocbao@example.com",
    fullName: "Trần Quốc Bảo",
    role: "user",
    locked: true,
    createdAt: "2026-05-01T00:00:00.000Z",
  },
];

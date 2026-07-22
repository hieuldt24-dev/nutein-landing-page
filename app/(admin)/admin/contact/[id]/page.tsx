"use client";

import { use } from "react";
import { AdminContactDetail } from "@/components/admin/AdminContactDetail";
import { AdminPageFrame } from "@/components/admin/AdminShell";
import { StaffOnlyGate } from "@/components/admin/StaffOnlyGate";

export default function AdminContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <AdminPageFrame>
      <StaffOnlyGate>
        <AdminContactDetail messageId={id} />
      </StaffOnlyGate>
    </AdminPageFrame>
  );
}

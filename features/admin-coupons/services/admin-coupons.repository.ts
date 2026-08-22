import "server-only";

import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { BadRequestError, NotFoundError } from "@/src/errors/app.error";
import { auditLogRepository } from "@/features/admin-audit/services/audit-log.repository";
import type { AdminCoupon, AdminCouponInput } from "../types";

interface CouponRow {
  id: string;
  code: string;
  discount_type: "FIXED" | "PERCENTAGE";
  discount: number | string;
  min_order_value: number | string | null;
  usage_limit: number | null;
  used_count: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

const COUPON_SELECT =
  "id, code, discount_type, discount, min_order_value, usage_limit, used_count, is_active, expires_at, created_at";

function requireAdminClient() {
  if (!supabaseAdmin) {
    throw new Error("Thiếu SUPABASE_SERVICE_ROLE_KEY — kiểm tra lại file .env");
  }
  return supabaseAdmin;
}

function toAdminCoupon(row: CouponRow): AdminCoupon {
  return {
    id: row.id,
    code: row.code,
    discountType: row.discount_type,
    discount: Number(row.discount),
    minOrderValue: row.min_order_value === null ? null : Number(row.min_order_value),
    usageLimit: row.usage_limit,
    usedCount: row.used_count,
    isActive: row.is_active,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

/** code là UNIQUE ở DB — 23505 = duplicate key (race hoặc bỏ sót check ở app). */
function isDuplicateCodeError(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

async function list(): Promise<AdminCoupon[]> {
  const client = requireAdminClient();
  const { data, error } = await client
    .from("coupons")
    .select(COUPON_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Không tải được danh sách coupon: ${error.message}`);
  }
  return ((data as CouponRow[]) ?? []).map(toAdminCoupon);
}

async function getById(id: string): Promise<AdminCoupon | null> {
  const client = requireAdminClient();
  const { data, error } = await client
    .from("coupons")
    .select(COUPON_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Không tải được coupon: ${error.message}`);
  }
  return data ? toAdminCoupon(data as CouponRow) : null;
}

/**
 * Tra coupon theo `code` (UNIQUE ở DB). Checkout dùng để pre-validate mã khách
 * nhập — chỉ ĐỌC, không đụng `used_count` (trigger `validate_and_apply_coupon()`
 * mới là nơi tăng lượt dùng, atomic lúc insert order).
 */
async function findByCode(code: string): Promise<AdminCoupon | null> {
  const client = requireAdminClient();
  const { data, error } = await client
    .from("coupons")
    .select(COUPON_SELECT)
    .eq("code", code)
    .maybeSingle();

  if (error) {
    throw new Error(`Không tra được coupon: ${error.message}`);
  }
  return data ? toAdminCoupon(data as CouponRow) : null;
}

async function create(input: AdminCouponInput, staffUserId: string): Promise<AdminCoupon> {
  const client = requireAdminClient();
  const { data, error } = await client
    .from("coupons")
    .insert({
      code: input.code,
      discount_type: input.discountType,
      discount: input.discount,
      min_order_value: input.minOrderValue ?? null,
      usage_limit: input.usageLimit ?? null,
      used_count: input.usedCount ?? 0,
      is_active: input.isActive,
      expires_at: input.expiresAt ?? null,
    })
    .select(COUPON_SELECT)
    .single();

  if (error) {
    if (isDuplicateCodeError(error)) {
      throw new BadRequestError("Mã đã tồn tại.");
    }
    throw new Error(`Không tạo được coupon: ${error.message}`);
  }

  const created = toAdminCoupon(data as CouponRow);
  // Best-effort, không ảnh hưởng response — chạy sau khi Staff đã nhận coupon
  // vừa tạo thay vì chờ thêm 1 round-trip DB ghi audit log.
  after(async () => {
    await auditLogRepository.record({
      userId: staffUserId,
      action: "CREATE",
      tableName: "coupons",
      recordId: created.id,
      newData: { code: created.code, discount: created.discount, discountType: created.discountType },
    });
  });

  return created;
}

async function update(
  id: string,
  input: Partial<AdminCouponInput>,
  staffUserId: string,
): Promise<AdminCoupon> {
  const client = requireAdminClient();
  const payload: Record<string, unknown> = {};
  if (input.code !== undefined) payload.code = input.code;
  if (input.discountType !== undefined) payload.discount_type = input.discountType;
  if (input.discount !== undefined) payload.discount = input.discount;
  if (input.minOrderValue !== undefined) payload.min_order_value = input.minOrderValue;
  if (input.usageLimit !== undefined) payload.usage_limit = input.usageLimit;
  if (input.usedCount !== undefined) payload.used_count = input.usedCount;
  if (input.isActive !== undefined) payload.is_active = input.isActive;
  if (input.expiresAt !== undefined) payload.expires_at = input.expiresAt;

  const { data, error } = await client
    .from("coupons")
    .update(payload)
    .eq("id", id)
    .select(COUPON_SELECT)
    .maybeSingle();

  if (error) {
    if (isDuplicateCodeError(error)) {
      throw new BadRequestError("Mã đã tồn tại.");
    }
    throw new Error(`Không cập nhật được coupon: ${error.message}`);
  }
  if (!data) {
    throw new NotFoundError("Coupon");
  }

  const updated = toAdminCoupon(data as CouponRow);
  // Best-effort, không ảnh hưởng response — chạy sau khi Staff đã nhận coupon
  // vừa cập nhật thay vì chờ thêm 1 round-trip DB ghi audit log.
  after(async () => {
    await auditLogRepository.record({
      userId: staffUserId,
      action: "UPDATE",
      tableName: "coupons",
      recordId: updated.id,
      newData: { code: updated.code, isActive: updated.isActive, discount: updated.discount },
    });
  });

  return updated;
}

export const adminCouponsRepository = {
  list,
  getById,
  findByCode,
  create,
  update,
};

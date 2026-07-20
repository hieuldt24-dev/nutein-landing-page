import "server-only";
import { supabaseAdmin } from "@/lib/supabase";
import type { ShippingAddress } from "../types";
import type { ShippingAddressFields } from "../schemas/address.schema";

interface AddressRow {
  id: string;
  label: string | null;
  province_code: string;
  province: string;
  ward_code: string;
  ward: string;
  street: string;
  is_default: boolean;
}

function toShippingAddress(row: AddressRow): ShippingAddress {
  return {
    id: row.id,
    label: row.label ?? undefined,
    provinceCode: row.province_code,
    province: row.province,
    wardCode: row.ward_code,
    ward: row.ward,
    street: row.street,
    isDefault: row.is_default,
  };
}

function toRowFields(fields: ShippingAddressFields) {
  return {
    label: fields.label?.trim() || null,
    province_code: fields.provinceCode.trim(),
    province: fields.province.trim(),
    ward_code: fields.wardCode.trim(),
    ward: fields.ward.trim(),
    street: fields.street.trim(),
  };
}

function requireAdminClient() {
  if (!supabaseAdmin) {
    throw new Error("Thiếu SUPABASE_SERVICE_ROLE_KEY — kiểm tra lại file .env");
  }
  return supabaseAdmin;
}

/**
 * CRUD sổ địa chỉ — bảng `user_addresses` (migration
 * 20260720020000_align_user_addresses_vn.sql). Luôn dùng supabaseAdmin
 * (service role) + tự scope theo `user_id` lấy từ authenticate() (JWT riêng
 * app), giống refresh-token.service.ts/audit-log.service.ts — không phụ
 * thuộc cookie session Supabase riêng ở mỗi request API.
 *
 * Bất biến "tối đa 1 địa chỉ mặc định/user" được DB ép bằng partial unique
 * index (idx_one_default_address) — service layer (address.service.ts) phải
 * tự xoá default cũ TRƯỚC khi set default mới để không vi phạm constraint.
 */
export const addressRepository = {
  async list(userId: string): Promise<ShippingAddress[]> {
    const { data, error } = await requireAdminClient()
      .from("user_addresses")
      .select(
        "id, label, province_code, province, ward_code, ward, street, is_default",
      )
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) {
      throw new Error(`Không tải được sổ địa chỉ: ${error.message}`);
    }
    return (data as AddressRow[]).map(toShippingAddress);
  },

  async findById(
    userId: string,
    addressId: string,
  ): Promise<ShippingAddress | null> {
    const { data, error } = await requireAdminClient()
      .from("user_addresses")
      .select(
        "id, label, province_code, province, ward_code, ward, street, is_default",
      )
      .eq("user_id", userId)
      .eq("id", addressId)
      .maybeSingle();
    if (error) {
      throw new Error(`Không tìm được địa chỉ: ${error.message}`);
    }
    return data ? toShippingAddress(data as AddressRow) : null;
  },

  async create(
    userId: string,
    fields: ShippingAddressFields,
    isDefault: boolean,
  ): Promise<ShippingAddress> {
    const { data, error } = await requireAdminClient()
      .from("user_addresses")
      .insert({
        user_id: userId,
        ...toRowFields(fields),
        is_default: isDefault,
      })
      .select(
        "id, label, province_code, province, ward_code, ward, street, is_default",
      )
      .single();
    if (error) {
      throw new Error(`Không thể thêm địa chỉ: ${error.message}`);
    }
    return toShippingAddress(data as AddressRow);
  },

  async update(
    userId: string,
    addressId: string,
    fields: ShippingAddressFields,
    isDefault: boolean,
  ): Promise<ShippingAddress> {
    const { data, error } = await requireAdminClient()
      .from("user_addresses")
      .update({ ...toRowFields(fields), is_default: isDefault })
      .eq("user_id", userId)
      .eq("id", addressId)
      .select(
        "id, label, province_code, province, ward_code, ward, street, is_default",
      )
      .single();
    if (error) {
      throw new Error(`Không thể cập nhật địa chỉ: ${error.message}`);
    }
    return toShippingAddress(data as AddressRow);
  },

  async remove(userId: string, addressId: string): Promise<void> {
    const { error } = await requireAdminClient()
      .from("user_addresses")
      .delete()
      .eq("user_id", userId)
      .eq("id", addressId);
    if (error) {
      throw new Error(`Không thể xoá địa chỉ: ${error.message}`);
    }
  },

  /** Bỏ cờ mặc định của MỌI địa chỉ user này — gọi trước khi set 1 địa chỉ khác làm mặc định. */
  async clearDefault(userId: string): Promise<void> {
    const { error } = await requireAdminClient()
      .from("user_addresses")
      .update({ is_default: false })
      .eq("user_id", userId)
      .eq("is_default", true);
    if (error) {
      throw new Error(`Không thể cập nhật địa chỉ mặc định: ${error.message}`);
    }
  },

  async setDefault(userId: string, addressId: string): Promise<void> {
    const { error } = await requireAdminClient()
      .from("user_addresses")
      .update({ is_default: true })
      .eq("user_id", userId)
      .eq("id", addressId);
    if (error) {
      throw new Error(`Không thể đặt địa chỉ mặc định: ${error.message}`);
    }
  },
};

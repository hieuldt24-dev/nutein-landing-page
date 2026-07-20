import "server-only";
import { NotFoundError } from "@/src/errors/app.error";
import type { ShippingAddress } from "../types";
import type { ShippingAddressFields } from "../schemas/address.schema";
import { addressRepository } from "./address.repository";

/**
 * Business logic sổ địa chỉ — enforce bất biến "tối đa 1 địa chỉ mặc định"
 * (DB chỉ ép được ở tầng constraint, thứ tự thao tác vẫn phải đúng ở đây để
 * không vi phạm idx_one_default_address). Route (`app/api/account/addresses/**`)
 * chỉ gọi service này, không tự query `addressRepository`.
 */
export const addressService = {
  async list(userId: string): Promise<ShippingAddress[]> {
    return addressRepository.list(userId);
  },

  async create(
    userId: string,
    fields: ShippingAddressFields,
  ): Promise<ShippingAddress> {
    const existing = await addressRepository.list(userId);
    // Địa chỉ đầu tiên của user luôn tự động là mặc định.
    const wantDefault = fields.isDefault === true || existing.length === 0;
    if (wantDefault) {
      await addressRepository.clearDefault(userId);
    }
    return addressRepository.create(userId, fields, wantDefault);
  },

  async update(
    userId: string,
    addressId: string,
    fields: ShippingAddressFields,
  ): Promise<ShippingAddress> {
    const current = await addressRepository.findById(userId, addressId);
    if (!current) throw new NotFoundError("Địa chỉ");

    // Giữ nguyên mặc định nếu đang là mặc định và không chủ động bỏ tick.
    const wantDefault =
      fields.isDefault === true ||
      (current.isDefault && fields.isDefault !== false);
    if (wantDefault && !current.isDefault) {
      await addressRepository.clearDefault(userId);
    }
    return addressRepository.update(userId, addressId, fields, wantDefault);
  },

  async remove(userId: string, addressId: string): Promise<void> {
    const current = await addressRepository.findById(userId, addressId);
    if (!current) throw new NotFoundError("Địa chỉ");

    await addressRepository.remove(userId, addressId);

    if (current.isDefault) {
      const remaining = await addressRepository.list(userId);
      if (remaining.length > 0) {
        await addressRepository.setDefault(userId, remaining[0].id);
      }
    }
  },

  async setDefault(
    userId: string,
    addressId: string,
  ): Promise<ShippingAddress> {
    const current = await addressRepository.findById(userId, addressId);
    if (!current) throw new NotFoundError("Địa chỉ");
    if (current.isDefault) return current;

    await addressRepository.clearDefault(userId);
    await addressRepository.setDefault(userId, addressId);
    return { ...current, isDefault: true };
  },
};

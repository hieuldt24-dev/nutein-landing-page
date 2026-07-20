import { ACCOUNT_LOCAL_LATENCY_MS } from "../constants";
import type { UpdateProfileInput } from "../schemas/profile.schema";
import type { UpsertAddressInput } from "../schemas/address.schema";
import type { SyncFromCheckoutInput } from "../schemas/sync-from-checkout.schema";
import type { AccountData, AccountProfile, ShippingAddress } from "../types";
import { accountRepository } from "./account.repository";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function ensureOneDefault(addresses: ShippingAddress[]): ShippingAddress[] {
  if (addresses.length === 0) return addresses;
  const hasDefault = addresses.some((a) => a.isDefault);
  if (hasDefault) return addresses;
  return addresses.map((a, i) => (i === 0 ? { ...a, isDefault: true } : a));
}

/**
 * Business logic account — mutate qua repository.
 * Chữ ký giữ khi đổi remote (fetch /api/account/*).
 */
export const accountService = {
  async getData(email: string): Promise<AccountData> {
    await delay(ACCOUNT_LOCAL_LATENCY_MS);
    return accountRepository.getData(email);
  },

  async getProfile(email: string): Promise<AccountProfile> {
    const data = await accountService.getData(email);
    return data.profile;
  },

  async updateProfile(email: string, input: UpdateProfileInput): Promise<AccountProfile> {
    await delay(ACCOUNT_LOCAL_LATENCY_MS);
    const key = normalizeEmail(email);
    const current = accountRepository.getData(key);
    const next: AccountData = {
      ...current,
      profile: {
        email: key,
        fullName: input.fullName.trim(),
        phone: input.phone.trim(),
      },
    };
    return accountRepository.setData(key, next).profile;
  },

  async listAddresses(email: string): Promise<ShippingAddress[]> {
    const data = await accountService.getData(email);
    return data.addresses;
  },

  async getDefaultAddress(email: string): Promise<ShippingAddress | null> {
    const addresses = await accountService.listAddresses(email);
    return addresses.find((a) => a.isDefault) ?? addresses[0] ?? null;
  },

  async upsertAddress(email: string, input: UpsertAddressInput): Promise<ShippingAddress> {
    await delay(ACCOUNT_LOCAL_LATENCY_MS);
    const key = normalizeEmail(email);
    const current = accountRepository.getData(key);
    const id = input.id?.trim() || crypto.randomUUID();
    const existing = current.addresses.find((a) => a.id === id);
    const wantDefault: boolean =
      input.isDefault === true ||
      (!existing && current.addresses.length === 0) ||
      Boolean(existing?.isDefault && input.isDefault !== false);

    let addresses = current.addresses.filter((a) => a.id !== id);
    if (wantDefault) {
      addresses = addresses.map((a) => ({ ...a, isDefault: false }));
    }

    const nextAddr: ShippingAddress = {
      id,
      label: input.label?.trim() || undefined,
      provinceCode: input.provinceCode.trim(),
      province: input.province.trim(),
      wardCode: input.wardCode.trim(),
      ward: input.ward.trim(),
      street: input.street.trim(),
      isDefault: wantDefault,
    };

    addresses = ensureOneDefault([...addresses, nextAddr]);
    accountRepository.setData(key, { ...current, addresses });
    return nextAddr;
  },

  async removeAddress(email: string, addressId: string): Promise<void> {
    await delay(ACCOUNT_LOCAL_LATENCY_MS);
    const key = normalizeEmail(email);
    const current = accountRepository.getData(key);
    const addresses = ensureOneDefault(
      current.addresses.filter((a) => a.id !== addressId)
    );
    accountRepository.setData(key, { ...current, addresses });
  },

  async setDefaultAddress(email: string, addressId: string): Promise<void> {
    await delay(ACCOUNT_LOCAL_LATENCY_MS);
    const key = normalizeEmail(email);
    const current = accountRepository.getData(key);
    const addresses = current.addresses.map((a) => ({
      ...a,
      isDefault: a.id === addressId,
    }));
    accountRepository.setData(key, { ...current, addresses: ensureOneDefault(addresses) });
  },

  /**
   * Entry duy nhất sync checkout → account khi saveInfo + order OK + logged in.
   * Khi có session server: có thể gọi từ checkoutService thay vì client.
   */
  async syncFromCheckout(email: string, input: SyncFromCheckoutInput): Promise<AccountData> {
    await delay(ACCOUNT_LOCAL_LATENCY_MS);
    const key = normalizeEmail(email);
    const current = accountRepository.getData(key);

    const profile: AccountProfile = {
      email: key,
      fullName: input.buyer.fullName.trim(),
      phone: input.buyer.phone.trim(),
    };

    const match = current.addresses.find(
      (a) =>
        a.street === input.address.street.trim() &&
        a.wardCode === input.address.wardCode.trim() &&
        a.provinceCode === input.address.provinceCode.trim()
    );

    let addresses: ShippingAddress[];
    if (match) {
      addresses = current.addresses.map((a) =>
        a.id === match.id
          ? {
              ...a,
              provinceCode: input.address.provinceCode.trim(),
              province: input.address.province.trim(),
              wardCode: input.address.wardCode.trim(),
              ward: input.address.ward.trim(),
              street: input.address.street.trim(),
              isDefault: true,
            }
          : { ...a, isDefault: false }
      );
    } else {
      const created: ShippingAddress = {
        id: crypto.randomUUID(),
        provinceCode: input.address.provinceCode.trim(),
        province: input.address.province.trim(),
        wardCode: input.address.wardCode.trim(),
        ward: input.address.ward.trim(),
        street: input.address.street.trim(),
        isDefault: true,
      };
      addresses = [
        ...current.addresses.map((a) => ({ ...a, isDefault: false })),
        created,
      ];
    }

    return accountRepository.setData(key, {
      profile,
      addresses: ensureOneDefault(addresses),
    });
  },
};

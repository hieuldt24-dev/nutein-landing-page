import { ACCOUNT_LOCAL_LATENCY_MS } from "../constants";
import type { UpdateProfileInput } from "../schemas/profile.schema";
import type { AccountData, AccountProfile } from "../types";
import { accountRepository } from "./account.repository";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Business logic hồ sơ user — mutate qua repository.
 * Sổ địa chỉ nay là dữ liệu thật, xem features/account/services/address.service.ts.
 * Chữ ký giữ khi đổi remote (fetch /api/account/profile).
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

  async updateProfile(
    email: string,
    input: UpdateProfileInput,
  ): Promise<AccountProfile> {
    await delay(ACCOUNT_LOCAL_LATENCY_MS);
    const key = normalizeEmail(email);
    const next: AccountData = {
      profile: {
        email: key,
        fullName: input.fullName.trim(),
        phone: input.phone.trim(),
      },
    };
    return accountRepository.setData(key, next).profile;
  },
};

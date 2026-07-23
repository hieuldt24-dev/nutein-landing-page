import "server-only";

import type { UpdateProfileInput } from "../schemas/profile.schema";
import type { AccountProfile } from "../types";
import { profileRepository } from "./profile.repository";

/** Hồ sơ user — route `/api/account/profile` gọi service này. */
export const profileService = {
  async getProfile(userId: string): Promise<AccountProfile> {
    return profileRepository.get(userId);
  },

  async updateProfile(
    userId: string,
    input: UpdateProfileInput,
  ): Promise<AccountProfile> {
    return profileRepository.update(userId, input);
  },
};

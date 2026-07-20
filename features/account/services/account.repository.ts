import { ACCOUNT_DATA_STORAGE_KEY } from "../constants";
import type { AccountData, AccountProfile } from "../types";

type AccountStore = Record<string, AccountData>;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function emptyData(email: string): AccountData {
  return {
    profile: { email: normalizeEmail(email) },
  };
}

function normalizeData(email: string, raw: unknown): AccountData {
  const base = emptyData(email);
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const profileRaw =
    o.profile && typeof o.profile === "object"
      ? (o.profile as Record<string, unknown>)
      : {};
  const profile: AccountProfile = {
    email: normalizeEmail(email),
    fullName:
      typeof profileRaw.fullName === "string" && profileRaw.fullName.trim()
        ? profileRaw.fullName.trim()
        : undefined,
    phone:
      typeof profileRaw.phone === "string" && profileRaw.phone.trim()
        ? profileRaw.phone.trim()
        : undefined,
  };
  return { profile };
}

function readStore(): AccountStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(ACCOUNT_DATA_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as AccountStore;
  } catch {
    return {};
  }
}

function writeStore(store: AccountStore): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCOUNT_DATA_STORAGE_KEY, JSON.stringify(store));
}

/**
 * Nguồn hồ sơ (fullName/phone) phía client — localStorage theo email.
 * Sổ địa chỉ KHÔNG còn ở đây — đã chuyển sang bảng `user_addresses` thật,
 * xem features/account/services/address.repository.ts.
 * Khi có API profile: đổi thân get/set sang fetch('/api/account/profile'), giữ chữ ký.
 */
export const accountRepository = {
  getData(email: string): AccountData {
    const key = normalizeEmail(email);
    if (!key) return emptyData("");
    const store = readStore();
    if (store[key]) return normalizeData(key, store[key]);
    return emptyData(key);
  },

  setData(email: string, data: AccountData): AccountData {
    const key = normalizeEmail(email);
    const next = normalizeData(key, data);
    const store = readStore();
    store[key] = next;
    writeStore(store);
    return next;
  },

  clearUser(email: string): void {
    const key = normalizeEmail(email);
    const store = readStore();
    if (!(key in store)) return;
    delete store[key];
    writeStore(store);
  },
};

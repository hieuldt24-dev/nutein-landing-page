import { ACCOUNT_DATA_STORAGE_KEY } from "../constants";
import type { AccountData, AccountProfile, ShippingAddress } from "../types";

type AccountStore = Record<string, AccountData>;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function emptyData(email: string): AccountData {
  return {
    profile: { email: normalizeEmail(email) },
    addresses: [],
  };
}

function normalizeAddress(raw: unknown): ShippingAddress | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : null;
  const provinceCode =
    typeof o.provinceCode === "string" && o.provinceCode.trim()
      ? o.provinceCode.trim()
      : null;
  const province =
    typeof o.province === "string" && o.province.trim() ? o.province.trim() : null;
  const wardCode =
    typeof o.wardCode === "string" && o.wardCode.trim() ? o.wardCode.trim() : null;
  const ward = typeof o.ward === "string" && o.ward.trim() ? o.ward.trim() : null;
  const street = typeof o.street === "string" && o.street.trim() ? o.street.trim() : null;
  if (!id || !provinceCode || !province || !wardCode || !ward || !street) {
    return null;
  }
  return {
    id,
    label:
      typeof o.label === "string" && o.label.trim() ? o.label.trim() : undefined,
    provinceCode,
    province,
    wardCode,
    ward,
    street,
    isDefault: Boolean(o.isDefault),
  };
}

function normalizeData(email: string, raw: unknown): AccountData {
  const base = emptyData(email);
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const profileRaw = o.profile && typeof o.profile === "object" ? (o.profile as Record<string, unknown>) : {};
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
  const addressesRaw = Array.isArray(o.addresses) ? o.addresses : [];
  const addresses = addressesRaw
    .map(normalizeAddress)
    .filter((a): a is ShippingAddress => a != null);
  return { profile, addresses };
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
 * Nguồn account (profile + addresses) phía client — localStorage theo email.
 * Khi có API: đổi thân get/set sang fetch('/api/account/...'), giữ chữ ký.
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

import { v3 } from "vietnam-divisions-js";

/** Địa giới VN 2 cấp (NQ 202/2025) — bọc `vietnam-divisions-js` v3. */

export interface VnProvinceOption {
  id: string;
  name: string;
  placeType: string;
}

export interface VnWardOption {
  id: string;
  name: string;
  provinceId: string;
}

export async function listVnProvinces(): Promise<VnProvinceOption[]> {
  const list = await v3.getAllProvincesSorted();
  return list.map((p) => ({
    id: p.idProvince,
    name: p.name,
    placeType: p.placeType,
  }));
}

export async function listVnWardsByProvince(provinceId: string): Promise<VnWardOption[]> {
  if (!provinceId) return [];
  const list = await v3.getCommunesByProvinceId(provinceId);
  return list
    .map((c) => ({
      id: c.idCommune,
      name: c.name,
      provinceId: c.idProvince,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

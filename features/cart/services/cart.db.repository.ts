import "server-only";

import { NUTEIN_PRODUCT_DB_ID } from "@/features/product/constants";
import { supabaseAdmin } from "@/lib/supabase";
import { normalizeCartState } from "../pricing";
import type { CartLine, CartState } from "../types";

interface CartRow {
  quantity: number;
  variant_id: string | null;
}

function requireAdminClient() {
  if (!supabaseAdmin) {
    throw new Error("Thiếu SUPABASE_SERVICE_ROLE_KEY — kiểm tra lại file .env");
  }
  return supabaseAdmin;
}

/**
 * Giỏ hàng DB (`cart`) — nhiều dòng / user theo `variant_id`
 * (UNIQUE user_id + product_id + variant_id sau migration multi-line).
 */
export const cartDbRepository = {
  async getState(userId: string): Promise<CartState> {
    const { data, error } = await requireAdminClient()
      .from("cart")
      .select("quantity, variant_id")
      .eq("user_id", userId)
      .eq("product_id", NUTEIN_PRODUCT_DB_ID);

    if (error) {
      throw new Error(`Không tải được giỏ hàng: ${error.message}`);
    }

    const lines: CartLine[] = ((data as CartRow[]) ?? []).map((row) => ({
      variantId: row.variant_id ?? "pack-1",
      quantity: row.quantity,
    }));

    return normalizeCartState({ lines });
  },

  async setState(userId: string, state: CartState): Promise<CartState> {
    const next = normalizeCartState(state);
    const client = requireAdminClient();

    // Replace toàn bộ dòng — tránh lệch khi đổi gói / xóa dòng.
    const { error: deleteError } = await client
      .from("cart")
      .delete()
      .eq("user_id", userId)
      .eq("product_id", NUTEIN_PRODUCT_DB_ID);

    if (deleteError) {
      throw new Error(`Không cập nhật được giỏ hàng: ${deleteError.message}`);
    }

    if (next.lines.length === 0) {
      return next;
    }

    const now = new Date().toISOString();
    const { error: insertError } = await client.from("cart").insert(
      next.lines.map((line) => ({
        user_id: userId,
        product_id: NUTEIN_PRODUCT_DB_ID,
        quantity: line.quantity,
        variant_id: line.variantId,
        updated_at: now,
      })),
    );

    if (insertError) {
      throw new Error(`Không cập nhật được giỏ hàng: ${insertError.message}`);
    }

    return next;
  },

  async clear(userId: string): Promise<void> {
    await cartDbRepository.setState(userId, { lines: [] });
  },
};

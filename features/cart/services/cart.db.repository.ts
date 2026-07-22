import "server-only";

import { NUTEIN_PRODUCT_DB_ID } from "@/features/product/constants";
import { supabaseAdmin } from "@/lib/supabase";
import { normalizeCartState } from "../pricing";
import type { CartLine, CartOwner, CartState } from "../types";

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

function ownerFilter(owner: CartOwner): { column: "user_id" | "session_id"; value: string } {
  if (owner.kind === "user") {
    return { column: "user_id", value: owner.userId };
  }
  return { column: "session_id", value: owner.sessionId };
}

/**
 * Giỏ hàng DB (`cart`) — dual key: `user_id` (logged-in) hoặc `session_id` (guest).
 */
export const cartDbRepository = {
  async getState(owner: CartOwner): Promise<CartState> {
    const { column, value } = ownerFilter(owner);
    const { data, error } = await requireAdminClient()
      .from("cart")
      .select("quantity, variant_id")
      .eq(column, value)
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

  async setState(owner: CartOwner, state: CartState): Promise<CartState> {
    const next = normalizeCartState(state);
    const client = requireAdminClient();
    const { column, value } = ownerFilter(owner);

    const { error: deleteError } = await client
      .from("cart")
      .delete()
      .eq(column, value)
      .eq("product_id", NUTEIN_PRODUCT_DB_ID);

    if (deleteError) {
      throw new Error(`Không cập nhật được giỏ hàng: ${deleteError.message}`);
    }

    if (next.lines.length === 0) {
      return next;
    }

    const now = new Date().toISOString();
    const rows = next.lines.map((line) =>
      owner.kind === "user"
        ? {
            user_id: owner.userId,
            session_id: null,
            product_id: NUTEIN_PRODUCT_DB_ID,
            quantity: line.quantity,
            variant_id: line.variantId,
            updated_at: now,
          }
        : {
            user_id: null,
            session_id: owner.sessionId,
            product_id: NUTEIN_PRODUCT_DB_ID,
            quantity: line.quantity,
            variant_id: line.variantId,
            updated_at: now,
          },
    );

    const { error: insertError } = await client.from("cart").insert(rows);

    if (insertError) {
      throw new Error(`Không cập nhật được giỏ hàng: ${insertError.message}`);
    }

    return next;
  },

  async clear(owner: CartOwner): Promise<void> {
    await cartDbRepository.setState(owner, { lines: [] });
  },
};

import { NextRequest } from "next/server";
import { createdResponse, successResponse } from "@/src/api/response";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { authenticate } from "@/src/middlewares/authenticate.middlware";
import { shippingAddressFieldsSchema } from "@/features/account/schemas/address.schema";
import { addressService } from "@/features/account/services/address.service";

/** GET /api/account/addresses — sổ địa chỉ của user đang đăng nhập. */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await authenticate(req);
  const addresses = await addressService.list(user.userId);
  return successResponse(addresses);
});

/** POST /api/account/addresses — thêm địa chỉ mới. */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await authenticate(req);
  const body = await req.json();
  const fields = shippingAddressFieldsSchema.parse(body);
  const created = await addressService.create(user.userId, fields);
  return createdResponse(created);
});

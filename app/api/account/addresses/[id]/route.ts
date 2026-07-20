import { NextRequest } from "next/server";
import { noContentResponse, successResponse } from "@/src/api/response";
import { BadRequestError } from "@/src/errors/app.error";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { authenticate } from "@/src/middlewares/authenticate.middlware";
import { shippingAddressFieldsSchema } from "@/features/account/schemas/address.schema";
import { addressService } from "@/features/account/services/address.service";

/** PATCH /api/account/addresses/[id] — cập nhật 1 địa chỉ của chính user. */
export const PATCH = withErrorHandler(async (req: NextRequest, context) => {
  const id = (await context?.params)?.id;
  if (!id) throw new BadRequestError("Thiếu id địa chỉ");

  const user = await authenticate(req);
  const body = await req.json();
  const fields = shippingAddressFieldsSchema.parse(body);
  const updated = await addressService.update(user.userId, id, fields);
  return successResponse(updated);
});

/** DELETE /api/account/addresses/[id] — xoá 1 địa chỉ của chính user. */
export const DELETE = withErrorHandler(async (req: NextRequest, context) => {
  const id = (await context?.params)?.id;
  if (!id) throw new BadRequestError("Thiếu id địa chỉ");

  const user = await authenticate(req);
  await addressService.remove(user.userId, id);
  return noContentResponse();
});

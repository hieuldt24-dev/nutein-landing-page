import { NextRequest } from "next/server";
import { successResponse } from "@/src/api/response";
import { BadRequestError } from "@/src/errors/app.error";
import { withErrorHandler } from "@/src/middlewares/error-handler.middleware";
import { authenticate } from "@/src/middlewares/authenticate.middlware";
import { addressService } from "@/features/account/services/address.service";

/** POST /api/account/addresses/[id]/default — đặt 1 địa chỉ làm mặc định. */
export const POST = withErrorHandler(async (req: NextRequest, context) => {
  const id = (await context?.params)?.id;
  if (!id) throw new BadRequestError("Thiếu id địa chỉ");

  const user = await authenticate(req);
  const updated = await addressService.setDefault(user.userId, id);
  return successResponse(updated);
});

import { NextRequest } from "next/server";
import { ZodSchema } from "zod";
import { ValidationError } from "@/src/errors/app.error";

const formatValidationError = (error: unknown) => {
  if (error && typeof error === "object" && "flatten" in error) {
    const flatten = error.flatten;
    if (typeof flatten === "function") {
      return flatten.call(error);
    }
  }

  return error instanceof Error ? error.message : error;
};

export const validateBody = async <T>(req: NextRequest, schema: ZodSchema<T>): Promise<T> => {
  try {
    const body = await req.json();
    return schema.parse(body);
  } catch (error: unknown) {
    throw new ValidationError(formatValidationError(error));
  }
};

export const validateParams = <T>(params: unknown, schema: ZodSchema<T>): T => {
  const result = schema.safeParse(params);
  if (!result.success) {
    throw new ValidationError(result.error.flatten());
  }
  return result.data;
};

export const validateQuery = <T>(req: NextRequest, schema: ZodSchema<T>): T => {
  const { searchParams } = new URL(req.url);
  const queryObj: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    queryObj[key] = value;
  });
  const result = schema.safeParse(queryObj);
  if (!result.success) {
    throw new ValidationError(result.error.flatten());
  }
  return result.data;
};

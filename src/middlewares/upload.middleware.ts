import { NextRequest } from "next/server";
import path from "path";
import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import { ValidationError } from "@/src/errors/app.error";

const uploadDir = path.join(process.cwd(), "public/uploads");

if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}

export interface UploadedFile {
  filename: string;
  filepath: string;
  mimetype: string;
  size: number;
}

export const handleFileUpload = async (
  req: NextRequest,
  fieldName = "file",
): Promise<UploadedFile> => {
  try {
    const formData = await req.formData();
    const file = formData.get(fieldName) as File | null;

    if (!file) {
      throw new ValidationError(`No file provided for field '${fieldName}'`);
    }

    if (!file.type.startsWith("image/")) {
      throw new ValidationError("Only image files are allowed!");
    }

    if (file.size > 1024 * 1024) {
      // 1MB
      throw new ValidationError("File size must be less than 1MB!");
    }

    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const fileExtension = path.extname(file.name);
    const filename = `${fieldName}-${uniqueSuffix}${fileExtension}`;
    const filepath = path.join(uploadDir, filename);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    await fs.writeFile(filepath, buffer);

    return {
      filename,
      filepath,
      mimetype: file.type,
      size: file.size,
    };
  } catch (error: unknown) {
    if (error instanceof ValidationError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "File upload failed";
    throw new ValidationError(message);
  }
};

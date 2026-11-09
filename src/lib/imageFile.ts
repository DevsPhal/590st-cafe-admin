import { translate } from "@/contexts/translate";

// Mirrors the API's image upload rules (MinioFileStorageService and spring.servlet.multipart.max-file-size),
// so a bad file is caught before it is sent.
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const IMAGE_ACCEPT = IMAGE_TYPES.join(",");
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Why this file can't be uploaded as an image, or null when it can. */
export function imageFileProblem(file: File): string | null {
  if (!IMAGE_TYPES.includes(file.type)) {
    return translate("validation.image_type", "Choose a JPEG, PNG, WebP or GIF image.");
  }
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
    return translate("validation.image_size", "Choose an image of 5 MB or smaller.");
  }
  return null;
}

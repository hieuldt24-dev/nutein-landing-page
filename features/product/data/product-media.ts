import type { ProductGalleryImage } from "../types";

export const DEFAULT_PRODUCT_IMAGE = "/media/product4.png";
export const DEFAULT_PRODUCT_IMAGE_ALT = "Hộp Protein thực vật Nutein";

export const DEFAULT_PRODUCT_GALLERY: ProductGalleryImage[] = [
  {
    id: "gallery-1",
    src: "https://res.cloudinary.com/jfgzg60i/image/upload/v1788257079/nutein/products/gallery-1-01.jpg",
    fit: "contain",
    alt: "Hộp Protein thực vật Nutein — góc chính",
  },
  {
    id: "gallery-2",
    src: "https://res.cloudinary.com/jfgzg60i/image/upload/v1788257081/nutein/products/gallery-2-03.jpg",
    alt: "Protein thực vật đa nguồn Nutein",
    fit: "contain",
  },
  {
    id: "gallery-3",
    src: "https://res.cloudinary.com/jfgzg60i/image/upload/v1788257082/nutein/products/gallery-3-04.jpg",
    alt: "Vitamin và khoáng chất trong Nutein",
    fit: "contain",
  },
  {
    id: "gallery-4",
    src: "https://res.cloudinary.com/jfgzg60i/image/upload/v1788257083/nutein/products/gallery-4-06.jpg",
    alt: "Chất xơ hòa tan trong Nutein",
    fit: "contain",
  },
];

const LEGACY_GALLERY_SOURCES = new Set([
  "/images/example.jpg",
  "/images/yogurt.jpg",
  "/images/beans.jpg",
  "/images/vegetables.jpg",
  "/media/hero-about.png",
  "/media/product3.png",
  "/media/product4.png",
]);

export function isLegacyProductGallery(gallery: ProductGalleryImage[] | undefined) {
  return (gallery ?? []).some(({ src }) => LEGACY_GALLERY_SOURCES.has(src));
}

export function isLegacyProductImage(image: string | undefined) {
  return image === "/images/example.jpg";
}

import type { ProductGalleryImage } from "../types";

export const DEFAULT_PRODUCT_IMAGE = "/media/product4.png";
export const DEFAULT_PRODUCT_IMAGE_ALT = "Hộp Protein thực vật Nutein";

export const DEFAULT_PRODUCT_GALLERY: ProductGalleryImage[] = [
  {
    id: "gallery-1",
    src: "/media/product4.png",
    alt: "Hộp Protein thực vật Nutein — góc chính",
  },
  {
    id: "gallery-2",
    src: "/media/4 card task 2 tách/size 1_1/4-ô-khác-biẹte_01.jpg",
    alt: "Protein thực vật đa nguồn Nutein",
    fit: "contain",
  },
  {
    id: "gallery-3",
    src: "/media/4 card task 2 tách/size 1_1/4-ô-khác-biẹte_04.jpg",
    alt: "Vitamin và khoáng chất trong Nutein",
    fit: "contain",
  },
  {
    id: "gallery-4",
    src: "/media/4 card task 2 tách/size 1_1/4-ô-khác-biẹte_03.jpg",
    alt: "Chất xơ hòa tan trong Nutein",
    fit: "contain",
  },
];

const LEGACY_GALLERY_SOURCES = new Set([
  "/images/example.jpg",
  "/images/yogurt.jpg",
  "/images/beans.jpg",
  "/images/vegetables.jpg",
]);

export function isLegacyProductGallery(gallery: ProductGalleryImage[] | undefined) {
  return Boolean(gallery?.length) && gallery.every(({ src }) => LEGACY_GALLERY_SOURCES.has(src));
}

export function isLegacyProductImage(image: string | undefined) {
  return image === "/images/example.jpg";
}

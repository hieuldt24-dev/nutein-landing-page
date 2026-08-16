"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import type { ProductGalleryImage, ProductSpec } from "@/features/product/types";
import { ProductSpecStack } from "@/components/product/ProductSpecStack";

interface ProductGalleryProps {
  productImage: string;
  productImageAlt: string;
  images: ProductGalleryImage[];
  specs: ProductSpec[];
  className?: string;
}

/**
 * Media Joy Rush:
 * [ảnh rộng 4:3] [USP cao bằng ảnh]
 * [thumbs full-width dưới cả hàng]
 */
export function ProductGallery({
  productImage,
  productImageAlt,
  images,
  specs,
  className,
}: ProductGalleryProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(128px,22%)] sm:gap-3 md:gap-3.5",
        className
      )}
    >
      <div className="relative aspect-[5/4] w-full overflow-hidden rounded-[18px] border-[1.5px] border-ink bg-primary-soft sm:col-start-1 sm:row-start-1">
        <Image
          src={productImage}
          alt={productImageAlt}
          fill
          sizes="(max-width: 1024px) 90vw, 55vw"
          priority
          className="object-cover"
        />
      </div>

      <div className="hidden min-h-0 sm:col-start-2 sm:row-start-1 sm:block sm:h-full">
        <ProductSpecStack specs={specs} className="h-full" />
      </div>

      {images.length > 1 ? (
        <ul
          aria-label="Điểm nổi bật sản phẩm"
          className="grid grid-cols-4 gap-2 sm:col-span-2 sm:row-start-2 md:gap-2.5"
        >
          {images.map((image) => (
            <li key={image.id}>
              <figure className="relative aspect-square w-full overflow-hidden rounded-[14px] border-[1.5px] border-transparent bg-primary-soft">
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  sizes="160px"
                  className={cn(image.fit === "contain" ? "object-contain" : "object-cover")}
                />
              </figure>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="sm:hidden">
        <ProductSpecStack specs={specs} />
      </div>
    </div>
  );
}

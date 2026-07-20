"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import type { ProductGalleryImage, ProductSpec } from "@/features/product/types";
import { ProductSpecStack } from "@/components/product/ProductSpecStack";

interface ProductGalleryProps {
  images: ProductGalleryImage[];
  specs: ProductSpec[];
  activeImageId: string;
  onSelect: (id: string) => void;
  className?: string;
}

/**
 * Media Joy Rush:
 * [ảnh rộng 4:3] [USP cao bằng ảnh]
 * [thumbs full-width dưới cả hàng]
 */
export function ProductGallery({
  images,
  specs,
  activeImageId,
  onSelect,
  className,
}: ProductGalleryProps) {
  const active = images.find((img) => img.id === activeImageId) ?? images[0];

  if (!active) return null;

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(128px,22%)] sm:gap-3 md:gap-3.5",
        className
      )}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[18px] border-[1.5px] border-ink bg-primary-soft sm:col-start-1 sm:row-start-1">
        {images.map((image) => {
          const isActive = image.id === active.id;
          return (
            <Image
              key={image.id}
              src={image.src}
              alt={isActive ? image.alt : ""}
              fill
              sizes="(max-width: 1024px) 90vw, 55vw"
              priority={image.id === images[0]?.id}
              aria-hidden={!isActive}
              className={cn(
                "object-cover transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                isActive
                  ? "z-[1] scale-100 opacity-100"
                  : "z-0 scale-[1.04] opacity-0"
              )}
            />
          );
        })}
      </div>

      <div className="hidden min-h-0 sm:col-start-2 sm:row-start-1 sm:block sm:h-full">
        <ProductSpecStack specs={specs} className="h-full" />
      </div>

      {images.length > 1 ? (
        <ul className="grid grid-cols-4 gap-2 sm:col-span-2 sm:row-start-2 md:gap-2.5">
          {images.map((image) => {
            const isActive = image.id === active.id;
            return (
              <li key={image.id}>
                <button
                  type="button"
                  onClick={() => onSelect(image.id)}
                  aria-label={image.alt}
                  aria-pressed={isActive}
                  className={cn(
                    "relative aspect-square w-full cursor-pointer overflow-hidden rounded-[14px] border-[1.5px] bg-primary-soft transition-[border-color,transform] duration-300 ease-out",
                    isActive
                      ? "border-ink"
                      : "border-transparent hover:border-ink/35"
                  )}
                >
                  <Image
                    src={image.src}
                    alt=""
                    fill
                    sizes="160px"
                    className={cn(
                      "object-cover transition-transform duration-500 ease-out",
                      isActive ? "scale-105" : "scale-100"
                    )}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="sm:hidden">
        <ProductSpecStack specs={specs} />
      </div>
    </div>
  );
}

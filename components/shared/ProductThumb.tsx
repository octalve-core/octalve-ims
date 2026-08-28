/**
 * REQ-0059 — product thumbnail with Package-icon fallback, same treatment as
 * the products table image cell. Reusable on order/invoice detail line
 * items, warehouse allocations, and catalog detail product lists — the
 * single most widely-shared piece of components/products/ProductOptionRow.tsx,
 * split out here so tier-agnostic shared components don't have to reach
 * into the core-bucketed components/products folder for it.
 */
import { Package } from "lucide-react";
import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";

const thumbSize = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
} as const;

const thumbPx = { sm: 32, md: 40, lg: 48 } as const;

export type ProductThumbProps = {
  name: string;
  imageUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function ProductThumb({
  name,
  imageUrl,
  size = "sm",
  className,
}: ProductThumbProps) {
  const dim = thumbSize[size];
  const unoptimized = Boolean(imageUrl?.includes("ik.imagekit.io"));

  return imageUrl ? (
    <SafeImage
      src={imageUrl}
      alt={name}
      width={thumbPx[size]}
      height={thumbPx[size]}
      className={cn(
        dim,
        "shrink-0 rounded-lg border border-violet-400/30 object-cover",
        className,
      )}
      unoptimized={unoptimized}
    />
  ) : (
    <span
      className={cn(
        dim,
        "flex shrink-0 items-center justify-center rounded-lg border border-violet-400/20 bg-gray-200/80 dark:bg-gray-700/80",
        className,
      )}
      aria-hidden
    >
      <Package className="h-4 w-4 text-gray-500 dark:text-gray-300" />
    </span>
  );
}

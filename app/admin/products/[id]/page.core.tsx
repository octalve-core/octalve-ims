import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import { getProductDetailForPage } from "@/lib/server/product-detail-data";
import ProductDetailPage from "@/components/Pages/ProductDetailPage";
import { enrichProductInsightsWithWarehouseStock } from "@/lib/catalog/product-insights-enrich";
import { getStockByProductForPage } from "@/lib/server/product-stock-data";
import type { Product } from "@/types";

type Props = { params: Promise<{ id: string }> };

/**
 * REQ-0025 — blocking SSR detail prefetch.
 * Core tier variant — no reviews SSR fetch (lib/product-reviews is
 * premium-only). Picked by scripts/export-tier.ts in place of the default
 * file when exporting Core (see page.pro.tsx for the identical Pro variant).
 */
export const dynamic = "force-dynamic";

export default async function AdminProductDetailPage({ params }: Props) {
  const user = await getSession();
  if (!user) redirect("/login");
  const { id } = await params;

  const [initialProduct, initialStockByProduct] = await Promise.all([
    getProductDetailForPage({ id: user.id, role: user.role }, id),
    getStockByProductForPage({ id: user.id, role: user.role }, id),
  ]);
  if (!initialProduct) notFound();

  const enrichedProduct = {
    ...initialProduct,
    productInsights: initialProduct.productInsights
      ? enrichProductInsightsWithWarehouseStock(
          initialProduct.productInsights,
          initialStockByProduct ?? [],
          Number(initialProduct.quantity),
        )
      : initialProduct.productInsights,
  };

  return (
    <ProductDetailPage
      embedInAdmin
      initialProduct={enrichedProduct as unknown as Product}
      initialStockByProduct={initialStockByProduct ?? undefined}
    />
  );
}

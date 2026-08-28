import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import { getOrderDetailForPage } from "@/lib/server/order-detail-data";
import { getOrderReviewContextForPage } from "@/lib/server/order-review-context-data";
import AdminOrderDetailContent from "@/components/orders/AdminOrderDetailContent";

type Props = {
  params: Promise<{ id: string }>;
};

/**
 * REQ-0025 — blocking SSR detail prefetch (no Suspense shell flash).
 * Core tier variant — no Stripe checkout-return reconciliation (Core has
 * no online-payment flow; lib/payments is Pro+). Picked by
 * scripts/export-tier.ts in place of the default file when exporting Core.
 */
export const dynamic = "force-dynamic";

export default async function AdminOrderDetailPage({ params }: Props) {
  const user = await getSession();
  if (!user) redirect("/login");
  const { id } = await params;

  const initialOrder = await getOrderDetailForPage(
    { id: user.id, role: user.role },
    id,
  );
  if (!initialOrder) notFound();

  const productIds =
    initialOrder.items?.map((item) => item.productId).filter(Boolean) ?? [];
  const initialReviewContext = await getOrderReviewContextForPage(
    user.id,
    id,
    productIds as string[],
  );

  return (
    <AdminOrderDetailContent
      backHref="/admin/orders"
      initialOrder={initialOrder}
      initialReviewContext={initialReviewContext}
    />
  );
}

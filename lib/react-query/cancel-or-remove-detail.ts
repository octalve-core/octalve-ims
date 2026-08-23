/**
 * Safe detail-query cleanup after delete.
 * If the detail page is still mounted (observers > 0), only cancel in-flight fetches.
 * removeQueries on an observed query refetches immediately and can 404 (e.g. soft-deleted product).
 * When the user navigates away, the observer unmounts and cache is garbage-collected normally.
 */

import type { QueryClient, QueryKey } from "@tanstack/react-query";

export function cancelOrRemoveDetailQuery(
  queryClient: QueryClient,
  detailKey: QueryKey,
): void {
  const cached = queryClient.getQueryCache().find({
    queryKey: detailKey,
    exact: true,
  });

  void queryClient.cancelQueries({ queryKey: detailKey });

  if (cached && cached.getObserversCount() > 0) {
    return;
  }

  queryClient.removeQueries({ queryKey: detailKey, exact: true });
}

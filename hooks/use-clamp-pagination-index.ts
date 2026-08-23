"use client";

/**
 * Clamps TanStack table pageIndex when filters/search shrink row count.
 * Prevents empty table + invalid "Page X of Y" while user stays on a high pageIndex.
 */

import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { PaginationType } from "@/components/shared/PaginationSelector";

export function useClampPaginationIndex(
  filteredCount: number,
  pagination: PaginationType,
  setPagination: Dispatch<SetStateAction<PaginationType>>,
): void {
  useEffect(() => {
    const pageCount = Math.max(1, Math.ceil(filteredCount / pagination.pageSize));
    const maxIndex = pageCount - 1;
    setPagination((prev) =>
      prev.pageIndex <= maxIndex ? prev : { ...prev, pageIndex: maxIndex },
    );
  }, [filteredCount, pagination.pageSize, setPagination]);
}

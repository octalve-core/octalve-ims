/**
 * Order Filters Component
 * Search and filter controls for orders
 * Matches Product section UI patterns with Status/Payment dropdowns
 *
 * Core variant: drops the Export dropdown (CSV/Excel via @/lib/export is
 * a Pro-tier feature) — everything else is identical to the default file.
 */

"use client";

import { FILTER_SEARCH_INPUT_SKY_CLASS } from "@/lib/ui/filter-toolbar-styles";
import React, { useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { IoClose } from "react-icons/io5";
import { PaginationType } from "@/components/shared/PaginationSelector";
import { DismissibleFilterChips } from "@/components/shared";
import type { FilterChipGroup } from "@/components/shared";
import { OrderStatusDropDown } from "./OrderStatusFilter";
import { PaymentStatusDropDown } from "./PaymentStatusFilter";
import {
  OrderSourceDropDown,
  type OrderSourceFilterValue,
} from "./OrderSourceFilter";
import { OrderStatusBadge, PaymentStatusBadge } from "@/lib/ui/semantic-badges";
import { FILTER_CHIP_COLLAPSED_CLASS } from "@/lib/ui/filter-chip-styles";
import type { Order } from "@/types";

const ORDER_SOURCE_LABELS: Record<OrderSourceFilterValue, string> = {
  client: "Client orders",
  personal: "Personal orders",
  both: "View both",
};

interface OrderFiltersProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  pagination: PaginationType;
  setPagination: (
    pagination: PaginationType | ((prev: PaginationType) => PaginationType),
  ) => void;
  allOrders: Order[];
  selectedStatuses: string[];
  setSelectedStatuses: React.Dispatch<React.SetStateAction<string[]>>;
  selectedPaymentStatuses: string[];
  setSelectedPaymentStatuses: React.Dispatch<React.SetStateAction<string[]>>;
  /** When set, show Order type filter (Client / Personal / View both) */
  showOrderSourceFilter?: boolean;
  orderSourceFilter?: OrderSourceFilterValue;
  setOrderSourceFilter?: (value: OrderSourceFilterValue) => void;
}

export default function OrderFilters({
  searchTerm,
  setSearchTerm,
  pagination,
  setPagination,
  allOrders,
  selectedStatuses,
  setSelectedStatuses,
  selectedPaymentStatuses,
  setSelectedPaymentStatuses,
  showOrderSourceFilter,
  orderSourceFilter = "both",
  setOrderSourceFilter,
}: OrderFiltersProps) {
  void allOrders; // only consumed by the Pro/Premium export handlers

  const handleResetFilters = useCallback(() => {
    setSelectedStatuses([]);
    setSelectedPaymentStatuses([]);
    if (setOrderSourceFilter) setOrderSourceFilter("both");
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [
    setSelectedStatuses,
    setSelectedPaymentStatuses,
    setOrderSourceFilter,
    setPagination,
  ]);

  const filterChipGroups = useMemo((): FilterChipGroup[] => {
    const groups: FilterChipGroup[] = [];

    if (showOrderSourceFilter && orderSourceFilter !== "both") {
      groups.push({
        label: "Type",
        values: [orderSourceFilter],
        onClear: () => setOrderSourceFilter?.("both"),
        renderBadge: (value) => (
          <span className={FILTER_CHIP_COLLAPSED_CLASS}>
            {ORDER_SOURCE_LABELS[value as OrderSourceFilterValue] ?? value}
          </span>
        ),
      });
    }

    groups.push(
      {
        label: "Status",
        values: selectedStatuses,
        onClear: () => setSelectedStatuses([]),
        renderBadge: (value) => (
          <OrderStatusBadge status={value} size="compact" />
        ),
      },
      {
        label: "Payment",
        values: selectedPaymentStatuses,
        onClear: () => setSelectedPaymentStatuses([]),
        renderBadge: (value) => (
          <PaymentStatusBadge status={value} size="compact" />
        ),
      },
    );

    return groups;
  }, [
    showOrderSourceFilter,
    orderSourceFilter,
    selectedStatuses,
    selectedPaymentStatuses,
    setOrderSourceFilter,
    setSelectedStatuses,
    setSelectedPaymentStatuses,
  ]);

  return (
    <div className="flex flex-col gap-2">
      {/* Single Row: Search (Left) | Filters (Middle) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        {/* Search Bar - Left */}
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600 dark:text-white/80 z-10" />
          <Input
            placeholder="Search by Order #..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={FILTER_SEARCH_INPUT_SKY_CLASS}
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchTerm("")}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 text-white/60 hover:text-white hover:bg-white/10 backdrop-blur-md"
            >
              <IoClose className="h-4 w-4 text-gray-700 dark:text-white/80" />
            </Button>
          )}
        </div>

        {/* Filters - Middle */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {showOrderSourceFilter && setOrderSourceFilter && (
            <OrderSourceDropDown
              value={orderSourceFilter}
              onChange={setOrderSourceFilter}
            />
          )}
          <OrderStatusDropDown
            selectedStatuses={selectedStatuses}
            setSelectedStatuses={setSelectedStatuses}
          />
          <PaymentStatusDropDown
            selectedPaymentStatuses={selectedPaymentStatuses}
            setSelectedPaymentStatuses={setSelectedPaymentStatuses}
          />
        </div>
      </div>

      <DismissibleFilterChips
        groups={filterChipGroups}
        onReset={handleResetFilters}
      />
    </div>
  );
}

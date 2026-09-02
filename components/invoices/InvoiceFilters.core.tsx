/**
 * Invoice Filters Component
 * Search and filter controls for invoices
 * Matches Order/Product section UI patterns with Status dropdown
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
import { InvoiceStatusDropDown } from "./InvoiceStatusFilter";
import {
  InvoiceSourceDropDown,
  type InvoiceSourceFilterValue,
} from "./InvoiceSourceFilter";
import { InvoiceStatusBadge } from "@/lib/ui/semantic-badges";
import { FILTER_CHIP_COLLAPSED_CLASS } from "@/lib/ui/filter-chip-styles";
import type { Invoice } from "@/types";

const INVOICE_SOURCE_LABELS: Record<InvoiceSourceFilterValue, string> = {
  client: "Client invoices",
  personal: "Personal invoices",
  both: "View both",
};

interface InvoiceFiltersProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  pagination: PaginationType;
  setPagination: (
    pagination: PaginationType | ((prev: PaginationType) => PaginationType),
  ) => void;
  allInvoices: Invoice[];
  selectedStatuses: string[];
  setSelectedStatuses: React.Dispatch<React.SetStateAction<string[]>>;
  /** When set, show Invoice type filter (Client / Personal / View both) */
  showInvoiceSourceFilter?: boolean;
  invoiceSourceFilter?: InvoiceSourceFilterValue;
  setInvoiceSourceFilter?: (value: InvoiceSourceFilterValue) => void;
}

export default function InvoiceFilters({
  searchTerm,
  setSearchTerm,
  pagination,
  setPagination,
  allInvoices,
  selectedStatuses,
  setSelectedStatuses,
  showInvoiceSourceFilter,
  invoiceSourceFilter = "both",
  setInvoiceSourceFilter,
}: InvoiceFiltersProps) {
  void allInvoices; // only consumed by the Pro/Premium export handlers

  const handleResetFilters = useCallback(() => {
    setSelectedStatuses([]);
    if (setInvoiceSourceFilter) setInvoiceSourceFilter("both");
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [setSelectedStatuses, setInvoiceSourceFilter, setPagination]);

  const filterChipGroups = useMemo((): FilterChipGroup[] => {
    const groups: FilterChipGroup[] = [];

    if (showInvoiceSourceFilter && invoiceSourceFilter !== "both") {
      groups.push({
        label: "Type",
        values: [invoiceSourceFilter],
        onClear: () => setInvoiceSourceFilter?.("both"),
        renderBadge: (value) => (
          <span className={FILTER_CHIP_COLLAPSED_CLASS}>
            {INVOICE_SOURCE_LABELS[value as InvoiceSourceFilterValue] ?? value}
          </span>
        ),
      });
    }

    groups.push({
      label: "Status",
      values: selectedStatuses,
      onClear: () => setSelectedStatuses([]),
      renderBadge: (value) => (
        <InvoiceStatusBadge status={value} size="compact" />
      ),
    });

    return groups;
  }, [
    showInvoiceSourceFilter,
    invoiceSourceFilter,
    selectedStatuses,
    setInvoiceSourceFilter,
    setSelectedStatuses,
  ]);

  return (
    <div className="flex flex-col gap-2">
      {/* Single Row: Search (Left) | Filters (Middle) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        {/* Search Bar - Left */}
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600 dark:text-white/80 z-10" />
          <Input
            placeholder="Search by Invoice #..."
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
          {showInvoiceSourceFilter && setInvoiceSourceFilter && (
            <InvoiceSourceDropDown
              value={invoiceSourceFilter}
              onChange={setInvoiceSourceFilter}
            />
          )}
          <InvoiceStatusDropDown
            selectedStatuses={selectedStatuses}
            setSelectedStatuses={setSelectedStatuses}
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

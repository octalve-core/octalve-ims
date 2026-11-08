import { describe, expect, it } from "vitest";
import { validateRows, transformFunctions, type ColumnMapping } from "@/lib/import";
import { productImportRowSchema } from "@/lib/validations/product";

/**
 * ISS-0086 — app/api/products-import/route.ts validated every imported row against
 * createProductSchema.extend({categoryName, supplierName}), but createProductSchema still
 * required categoryId/supplierId/userId underneath — fields simplifiedMapping never produces
 * (it produces categoryName/supplierName strings; userId comes from the session, not a column).
 * Every row's Zod parse threw "Required" on those three fields before any real per-row check
 * (name/SKU/price/quantity/status/category-exists/supplier-exists) ever ran, so the import
 * always failed every row, well-formed or not, with the same three irrelevant messages.
 * productImportRowSchema fixes this by validating exactly what the import's own mapping
 * produces, leaving categoryId/supplierId/userId resolution to the route's post-validation
 * lookup step (unchanged).
 */

const IMPORT_MAPPING: ColumnMapping[] = [
  { importColumn: "Product Name", schemaField: "name", transform: (v) => String(v).trim() },
  { importColumn: "SKU", schemaField: "sku", transform: (v) => String(v).trim().toUpperCase() },
  { importColumn: "Price", schemaField: "price", transform: transformFunctions.toNumber },
  { importColumn: "Quantity", schemaField: "quantity", transform: transformFunctions.toInteger },
  {
    importColumn: "Status",
    schemaField: "status",
    transform: (v) => {
      const s = String(v).trim();
      return ["Available", "Stock Low", "Stock Out"].includes(s) ? s : "Available";
    },
  },
  { importColumn: "Category", schemaField: "categoryName", transform: (v) => String(v).trim() },
  { importColumn: "Supplier", schemaField: "supplierName", transform: (v) => String(v).trim() },
];

function row(rowNumber: number, data: Record<string, string | number>) {
  return { rowNumber, isHeader: false, data };
}

const WELL_FORMED_ROWS = [
  row(2, {
    "Product Name": "Ginger Beer 330ml",
    SKU: "GIN-330",
    Price: "250.00",
    Quantity: "80",
    Status: "Available",
    Category: "Beverages",
    Supplier: "Lagos Fresh Foods",
  }),
  row(3, {
    "Product Name": "Plantain Chips 100g",
    SKU: "PLC-100",
    Price: "150.00",
    Quantity: "120",
    Status: "Available",
    Category: "Snacks",
    Supplier: "Lagos Fresh Foods",
  }),
];

describe("product import validation (ISS-0086)", () => {
  it("accepts well-formed rows — no spurious categoryId/supplierId/userId 'Required' errors", () => {
    const result = validateRows(WELL_FORMED_ROWS, productImportRowSchema, IMPORT_MAPPING);
    expect(result.errors).toEqual([]);
    expect(result.validRows).toHaveLength(2);
    expect(result.validRows[0]).toMatchObject({
      name: "Ginger Beer 330ml",
      sku: "GIN-330",
      categoryName: "Beverages",
      supplierName: "Lagos Fresh Foods",
    });
  });

  it("still rejects a row with a missing product name, for the real reason", () => {
    const result = validateRows(
      [
        row(8, {
          "Product Name": "",
          SKU: "MISSING-NAME",
          Price: "100.00",
          Quantity: "10",
          Status: "Available",
          Category: "Beverages",
          Supplier: "Lagos Fresh Foods",
        }),
      ],
      productImportRowSchema,
      IMPORT_MAPPING,
    );
    expect(result.validRows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.field).toBe("name");
    expect(result.errors[0]!.message).not.toMatch(/categoryId|supplierId|userId/i);
  });

  it("still rejects a row with a negative price, for the real reason", () => {
    const result = validateRows(
      [
        row(9, {
          "Product Name": "Bad Price Item",
          SKU: "BAD-PRICE",
          Price: "-50.00",
          Quantity: "10",
          Status: "Available",
          Category: "Snacks",
          Supplier: "Lagos Fresh Foods",
        }),
      ],
      productImportRowSchema,
      IMPORT_MAPPING,
    );
    expect(result.validRows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.field).toBe("price");
    expect(result.errors[0]!.message).not.toMatch(/categoryId|supplierId|userId/i);
  });
});

import { PrismaClient, Prisma } from "@prisma/client";

/**
 * Prisma Client Singleton
 * Prevents connection exhaustion by reusing the same instance
 * Connection pooling is configured in the connection string
 * Example: DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=10"
 */

// ISS-0052: money columns are `Decimal` at the DB level (exact, unlike
// `Float`'s binary rounding), but every call site in this codebase — API
// responses, arithmetic, display — was written assuming a plain `number`.
// Rather than touch each of those dozens of call sites (and risk `+` on two
// Decimal instances silently string-concatenating instead of adding, since
// Decimal.valueOf() returns a string), this extension converts every money
// field back to `number` right here, once, so nothing downstream of the
// shared `prisma` export ever sees a `Decimal` instance.
const toMoneyNumber = (value: Prisma.Decimal | null): number | null => (value === null ? null : value.toNumber());

function createPrismaClient() {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"] // Removed "query" to reduce log noise
        : ["error"],
  }).$extends({
    name: "money-decimal-to-number",
    result: {
      product: {
        price: { needs: { price: true }, compute: (product) => product.price.toNumber() },
      },
      productSupplier: {
        supplierPrice: { needs: { supplierPrice: true }, compute: (row) => toMoneyNumber(row.supplierPrice) },
      },
      order: {
        subtotal: { needs: { subtotal: true }, compute: (order) => order.subtotal.toNumber() },
        tax: { needs: { tax: true }, compute: (order) => toMoneyNumber(order.tax) },
        shipping: { needs: { shipping: true }, compute: (order) => toMoneyNumber(order.shipping) },
        discount: { needs: { discount: true }, compute: (order) => toMoneyNumber(order.discount) },
        total: { needs: { total: true }, compute: (order) => order.total.toNumber() },
      },
      orderItem: {
        price: { needs: { price: true }, compute: (item) => item.price.toNumber() },
        subtotal: { needs: { subtotal: true }, compute: (item) => item.subtotal.toNumber() },
      },
      invoice: {
        subtotal: { needs: { subtotal: true }, compute: (invoice) => invoice.subtotal.toNumber() },
        tax: { needs: { tax: true }, compute: (invoice) => toMoneyNumber(invoice.tax) },
        shipping: { needs: { shipping: true }, compute: (invoice) => toMoneyNumber(invoice.shipping) },
        discount: { needs: { discount: true }, compute: (invoice) => toMoneyNumber(invoice.discount) },
        total: { needs: { total: true }, compute: (invoice) => invoice.total.toNumber() },
        amountPaid: { needs: { amountPaid: true }, compute: (invoice) => invoice.amountPaid.toNumber() },
        amountDue: { needs: { amountDue: true }, compute: (invoice) => invoice.amountDue.toNumber() },
      },
      processedPayment: {
        amount: { needs: { amount: true }, compute: (row) => row.amount.toNumber() },
      },
      processedRefund: {
        amount: { needs: { amount: true }, compute: (row) => row.amount.toNumber() },
      },
    },
  });
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

// The extension above makes every money field a real `number` at runtime,
// but `Prisma.<Model>GetPayload<...>` is derived from the static schema and
// still types those fields as `Decimal` — these aliases are what call sites
// should annotate with instead, so the declared type matches what the
// extension actually returns.
export type InvoiceWithMoneyAsNumber = Omit<
  Prisma.InvoiceGetPayload<Record<string, never>>,
  "subtotal" | "tax" | "shipping" | "discount" | "total" | "amountPaid" | "amountDue"
> & {
  subtotal: number;
  tax: number | null;
  shipping: number | null;
  discount: number | null;
  total: number;
  amountPaid: number;
  amountDue: number;
};

export type OrderWithMoneyAsNumber = Omit<
  Prisma.OrderGetPayload<Record<string, never>>,
  "subtotal" | "tax" | "shipping" | "discount" | "total"
> & {
  subtotal: number;
  tax: number | null;
  shipping: number | null;
  discount: number | null;
  total: number;
};

export type OrderItemWithMoneyAsNumber = Omit<Prisma.OrderItemGetPayload<Record<string, never>>, "price" | "subtotal"> & {
  price: number;
  subtotal: number;
};

export type ProductWithMoneyAsNumber = Omit<Prisma.ProductGetPayload<Record<string, never>>, "price"> & {
  price: number;
};

export type OrderWithItemsMoneyAsNumber = OrderWithMoneyAsNumber & {
  items: OrderItemWithMoneyAsNumber[];
};

// PrismaClient is attached to the `global` object in development
// to prevent exhausting database connections during hot reloads
declare global {
  var prisma: ExtendedPrismaClient | undefined;
}

// Only initialize Prisma on server-side
const isServer = typeof window === "undefined";

export const prisma = isServer
  ? (globalThis as { prisma?: ExtendedPrismaClient }).prisma || createPrismaClient()
  : ({} as ExtendedPrismaClient); // Dummy client for client-side (should never be used)

if (isServer && process.env.NODE_ENV !== "production") {
  (globalThis as { prisma?: ExtendedPrismaClient }).prisma = prisma;
}

// Test database connection (server-side only)
if (isServer) {
  prisma
    .$connect()
    .then(() => console.log("✓ Connected to the database"))
    .catch((error) => console.error("✗ Database connection error:", error));
}

export default prisma;

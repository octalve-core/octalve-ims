/**
 * Full-coverage demo seed — every Prisma model gets >=4 rows so every list/
 * filter/detail page has real pagination, filtering, and empty-state data to
 * exercise. Reuses the same 4 canonical accounts as the login dropdown/
 * reset-demo-db (DEMO_SEED_USERS), then adds 4 business-scoped RBAC accounts
 * on top — distinct from seed-demo-catalog.ts (REQ-0137's 1-2 row "explore"
 * fixtures) which this is meant to replace for local QA of tables and
 * dashboards, not for testing the canonical account set itself.
 *
 * Wipes the database first (see prisma/seed.ts) — never run this against a
 * shared/production DATABASE_URL.
 */

import crypto from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_EMAIL_PREFERENCES } from "@/types/auth";
import { getRoboHashAvatarUrl } from "@/lib/ui/user-avatar-sources";
import {
  DEMO_PASSWORD,
  DEMO_SEED_USERS,
  type DemoSeedUser,
} from "@/lib/auth/demo-seed-users";

const BCRYPT_ROUNDS = 10;

const day = (isoDate: string) => new Date(isoDate);
const addDays = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};
const randomHash = () => crypto.randomBytes(32).toString("hex");

function address(overrides: Partial<Record<string, string>> = {}) {
  return {
    street: "42 Explore Lane",
    city: "Austin",
    state: "TX",
    zipCode: "78701",
    country: "US",
    ...overrides,
  } as unknown as Prisma.InputJsonValue;
}

export type FullDemoSeedResult = Record<string, number>;

export async function seedFullDemo(prisma: PrismaClient): Promise<FullDemoSeedResult> {
  const now = new Date();
  const counts: FullDemoSeedResult = {};
  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS);

  // ---------------------------------------------------------------------
  // Business (4)
  // ---------------------------------------------------------------------
  const businessSpecs = [
    { name: "Nimbus Retail Co" },
    { name: "Blue Anchor Traders" },
    { name: "Solstice Hardware" },
    { name: "Vertex Wholesale" },
  ];
  const businesses = [];
  for (const spec of businessSpecs) {
    businesses.push(
      await prisma.business.create({ data: { name: spec.name, createdAt: now } }),
    );
  }
  counts.Business = businesses.length;

  // ---------------------------------------------------------------------
  // Role (2 system + 1 custom per business = 6) + Permission (>=4)
  // ---------------------------------------------------------------------
  const adminRole = await prisma.role.create({
    data: { name: "Admin", isSystem: true, businessId: null },
  });
  const staffRole = await prisma.role.create({
    data: { name: "Staff", isSystem: true, businessId: null },
  });

  const customRoleNames = ["Manager", "Warehouse Lead", "Purchasing Lead", "Store Ops"];
  const customRoles = [];
  for (let i = 0; i < businesses.length; i++) {
    customRoles.push(
      await prisma.role.create({
        data: {
          name: customRoleNames[i]!,
          businessId: businesses[i]!.id,
          isSystem: false,
        },
      }),
    );
  }
  counts.Role = 2 + customRoles.length;

  const resources = ["Products", "Stock", "Orders", "Purchasing", "Invoicing", "Users", "Reports"];
  let permissionCount = 0;
  for (const action of ["view", "create", "edit", "delete", "approve"]) {
    for (const resource of resources) {
      await prisma.permission.create({
        data: { roleId: adminRole.id, resource, action },
      });
      permissionCount++;
    }
  }
  for (const action of ["view", "create"]) {
    for (const resource of ["Products", "Stock", "Orders"]) {
      await prisma.permission.create({
        data: { roleId: staffRole.id, resource, action },
      });
      permissionCount++;
    }
  }
  const customPermissionSets: Array<{ resource: string; action: string }[]> = [
    [
      { resource: "Products", action: "view" },
      { resource: "Orders", action: "view" },
      { resource: "Orders", action: "edit" },
      { resource: "Reports", action: "view" },
    ],
    [
      { resource: "Stock", action: "view" },
      { resource: "Stock", action: "edit" },
      { resource: "Products", action: "view" },
      { resource: "Reports", action: "view" },
    ],
    [
      { resource: "Purchasing", action: "view" },
      { resource: "Purchasing", action: "create" },
      { resource: "Purchasing", action: "approve" },
      { resource: "Products", action: "view" },
    ],
    [
      { resource: "Orders", action: "view" },
      { resource: "Invoicing", action: "view" },
      { resource: "Invoicing", action: "create" },
      { resource: "Reports", action: "view" },
    ],
  ];
  for (let i = 0; i < customRoles.length; i++) {
    for (const perm of customPermissionSets[i]!) {
      await prisma.permission.create({
        data: { roleId: customRoles[i]!.id, resource: perm.resource, action: perm.action },
      });
      permissionCount++;
    }
  }
  counts.Permission = permissionCount;

  // ---------------------------------------------------------------------
  // User (4 canonical demo accounts, from DEMO_SEED_USERS — same accounts
  // the login-dropdown/reset-demo-db flow uses — + 4 business-scoped
  // accounts = 8)
  // ---------------------------------------------------------------------
  const emailPreferences = DEFAULT_EMAIL_PREFERENCES as unknown as Prisma.InputJsonValue;

  const canonicalByRole: Partial<Record<DemoSeedUser["role"], Awaited<ReturnType<typeof prisma.user.create>>>> = {};
  for (const spec of DEMO_SEED_USERS) {
    const user = await prisma.user.create({
      data: {
        email: spec.email,
        name: spec.name,
        username: spec.username,
        password: hashedPassword,
        role: spec.role,
        roleId: spec.role === "admin" ? adminRole.id : undefined,
        googleId: spec.googleId,
        image: spec.image,
        emailPreferences,
        createdAt: now,
        updatedAt: now,
      },
    });
    canonicalByRole[spec.role] = user;
  }
  const admin = canonicalByRole.admin!;
  const client = canonicalByRole.client!;
  const supplierUser = canonicalByRole.supplier!;
  const retailer = canonicalByRole.retailer!;

  const businessUserSpecs = [
    { email: "manager@nimbusretail.demo", name: "Priya Sharma", username: "priyasharma" },
    { email: "lead@blueanchor.demo", name: "Sam Okafor", username: "samokafor" },
    { email: "purchasing@solsticehw.demo", name: "Jordan Lee", username: "jordanlee" },
    { email: "ops@vertexwholesale.demo", name: "Casey Nguyen", username: "caseynguyen" },
  ];
  const businessUsers = [];
  for (let i = 0; i < businessUserSpecs.length; i++) {
    const spec = businessUserSpecs[i]!;
    businessUsers.push(
      await prisma.user.create({
        data: {
          email: spec.email,
          name: spec.name,
          username: spec.username,
          password: hashedPassword,
          role: null,
          roleId: customRoles[i]!.id,
          businessId: businesses[i]!.id,
          googleId: `demo-${spec.username}`,
          image: getRoboHashAvatarUrl(`demo-${spec.username}`),
          emailPreferences,
          createdAt: now,
          updatedAt: now,
        },
      }),
    );
  }
  counts.User = 4 + businessUsers.length;

  // ---------------------------------------------------------------------
  // Supplier (4)
  // ---------------------------------------------------------------------
  const testSupplier = await prisma.supplier.create({
    data: {
      name: "Test Supplier",
      description:
        "Global Test Supplier linked to test@supplier.com. All admins can assign products to this supplier.",
      notes: "Use Test Supplier when creating products to see them under test@supplier.com's My Products.",
      status: true,
      userId: supplierUser.id,
      createdBy: supplierUser.id,
      updatedBy: supplierUser.id,
      createdAt: now,
      updatedAt: now,
    },
  });
  const localParts = await prisma.supplier.create({
    data: {
      name: "Local Parts Co",
      description: "Editable local supplier for demo UI explore (not global).",
      notes: "Safe to edit/delete in QA — not linked to test@supplier.com.",
      status: true,
      userId: admin.id,
      createdBy: admin.id,
      updatedBy: admin.id,
      createdAt: now,
      updatedAt: now,
    },
  });
  const globalTraders = await prisma.supplier.create({
    data: {
      name: "Global Traders",
      description: "International sourcing partner for electronics and appliances.",
      notes: "Longer lead times, better unit pricing on bulk orders.",
      status: true,
      userId: admin.id,
      createdBy: admin.id,
      updatedBy: admin.id,
      createdAt: now,
      updatedAt: now,
    },
  });
  const northStar = await prisma.supplier.create({
    data: {
      name: "North Star Distribution",
      description: "Regional distributor for furniture and office supplies.",
      notes: "Preferred vendor for bulky/freight-shipped items.",
      status: false,
      userId: admin.id,
      createdBy: admin.id,
      updatedBy: admin.id,
      createdAt: now,
      updatedAt: now,
    },
  });
  counts.Supplier = 4;

  // ---------------------------------------------------------------------
  // Category (4)
  // ---------------------------------------------------------------------
  const categorySpecs = [
    { name: "Headphone", description: "Over-ear and on-ear headphones for demo browsing.", notes: "Primary category for Beats demo SKU." },
    { name: "TV", description: "Televisions and displays.", notes: "Secondary demo category for Sony TV." },
    { name: "Laptop", description: "Laptops and notebooks.", notes: "Category for UltraBook demo SKU." },
    { name: "Office Furniture", description: "Desks, chairs, and office fit-out items.", notes: "Category for freight-shipped demo SKUs." },
  ];
  const categories = [];
  for (const spec of categorySpecs) {
    categories.push(
      await prisma.category.create({
        data: {
          name: spec.name,
          description: spec.description,
          notes: spec.notes,
          status: true,
          userId: admin.id,
          createdBy: admin.id,
          updatedBy: admin.id,
          createdAt: now,
          updatedAt: now,
        },
      }),
    );
  }
  counts.Category = categories.length;
  const [headphoneCat, tvCat, laptopCat, furnitureCat] = categories as [
    (typeof categories)[number],
    (typeof categories)[number],
    (typeof categories)[number],
    (typeof categories)[number],
  ];

  // ---------------------------------------------------------------------
  // Warehouse (4)
  // ---------------------------------------------------------------------
  const warehouseSpecs = [
    { name: "Main Warehouse", address: "100 Demo Industrial Park, Austin, TX 78701", type: "main" },
    { name: "Secondary Storage", address: "200 Backup Lane, Austin, TX 78702", type: "secondary" },
    { name: "East Coast Hub", address: "18 Harbor Row, Newark, NJ 07102", type: "regional" },
    { name: "West Coast Hub", address: "900 Bayfront Ave, Oakland, CA 94607", type: "regional" },
  ];
  const warehouses = [];
  for (const spec of warehouseSpecs) {
    warehouses.push(
      await prisma.warehouse.create({
        data: {
          name: spec.name,
          address: spec.address,
          type: spec.type,
          status: true,
          userId: admin.id,
          createdBy: admin.id,
          updatedBy: admin.id,
          createdAt: now,
          updatedAt: now,
        },
      }),
    );
  }
  counts.Warehouse = warehouses.length;
  const [mainWh, secondaryWh, eastWh, westWh] = warehouses as [
    (typeof warehouses)[number],
    (typeof warehouses)[number],
    (typeof warehouses)[number],
    (typeof warehouses)[number],
  ];

  // ---------------------------------------------------------------------
  // Product (4) + ProductSupplier (6)
  // ---------------------------------------------------------------------
  const beats = await prisma.product.create({
    data: {
      name: "Beats",
      sku: "SK56",
      price: 199,
      quantity: BigInt(50),
      reservedQuantity: BigInt(0),
      status: "Available",
      categoryId: headphoneCat.id,
      supplierId: testSupplier.id,
      userId: admin.id,
      createdBy: admin.id,
      updatedBy: admin.id,
      expirationDate: day("2027-12-31"),
      createdAt: now,
      updatedAt: now,
    },
  });
  const sonyTv = await prisma.product.create({
    data: {
      name: "Sony TV",
      sku: "BT23",
      price: 499,
      quantity: BigInt(98),
      reservedQuantity: BigInt(0),
      status: "Available",
      categoryId: tvCat.id,
      supplierId: testSupplier.id,
      userId: admin.id,
      createdBy: admin.id,
      updatedBy: admin.id,
      expirationDate: day("2028-06-15"),
      createdAt: now,
      updatedAt: now,
    },
  });
  const ultraBook = await prisma.product.create({
    data: {
      name: "UltraBook Pro 14",
      sku: "LP89",
      price: 1299,
      quantity: BigInt(40),
      reservedQuantity: BigInt(0),
      status: "Available",
      categoryId: laptopCat.id,
      supplierId: globalTraders.id,
      userId: admin.id,
      createdBy: admin.id,
      updatedBy: admin.id,
      expirationDate: day("2029-01-31"),
      createdAt: now,
      updatedAt: now,
    },
  });
  const deskChair = await prisma.product.create({
    data: {
      name: "Oakwood Desk Chair",
      sku: "FN12",
      price: 249,
      quantity: BigInt(25),
      reservedQuantity: BigInt(0),
      status: "Low Stock",
      categoryId: furnitureCat.id,
      supplierId: northStar.id,
      userId: admin.id,
      createdBy: admin.id,
      updatedBy: admin.id,
      expirationDate: day("2030-03-01"),
      createdAt: now,
      updatedAt: now,
    },
  });
  counts.Product = 4;

  const productSupplierSpecs: Array<{
    product: typeof beats;
    supplier: typeof testSupplier;
    supplierSku: string;
    supplierPrice: number;
    leadTimeDays: number;
  }> = [
    { product: beats, supplier: testSupplier, supplierSku: "TS-SK56", supplierPrice: 150, leadTimeDays: 5 },
    { product: beats, supplier: localParts, supplierSku: "LPC-SK56", supplierPrice: 160, leadTimeDays: 2 },
    { product: sonyTv, supplier: testSupplier, supplierSku: "TS-BT23", supplierPrice: 400, leadTimeDays: 7 },
    { product: ultraBook, supplier: globalTraders, supplierSku: "GT-LP89", supplierPrice: 1050, leadTimeDays: 14 },
    { product: ultraBook, supplier: localParts, supplierSku: "LPC-LP89", supplierPrice: 1100, leadTimeDays: 4 },
    { product: deskChair, supplier: northStar, supplierSku: "NSD-FN12", supplierPrice: 180, leadTimeDays: 10 },
  ];
  for (const spec of productSupplierSpecs) {
    await prisma.productSupplier.create({
      data: {
        productId: spec.product.id,
        supplierId: spec.supplier.id,
        supplierSku: spec.supplierSku,
        supplierPrice: spec.supplierPrice,
        leadTimeDays: spec.leadTimeDays,
        createdAt: now,
      },
    });
  }
  counts.ProductSupplier = productSupplierSpecs.length;

  // ---------------------------------------------------------------------
  // StockAllocation (5)
  // ---------------------------------------------------------------------
  const allocationSpecs = [
    { product: beats, warehouse: mainWh, quantity: 30, reservedQuantity: 20 },
    { product: sonyTv, warehouse: mainWh, quantity: 49, reservedQuantity: 0 },
    { product: sonyTv, warehouse: secondaryWh, quantity: 18, reservedQuantity: 1 },
    { product: ultraBook, warehouse: eastWh, quantity: 40, reservedQuantity: 5 },
    { product: deskChair, warehouse: westWh, quantity: 25, reservedQuantity: 0 },
  ];
  for (const spec of allocationSpecs) {
    await prisma.stockAllocation.create({
      data: {
        productId: spec.product.id,
        warehouseId: spec.warehouse.id,
        quantity: BigInt(spec.quantity),
        reservedQuantity: BigInt(spec.reservedQuantity),
        userId: admin.id,
        createdAt: now,
        updatedAt: now,
      },
    });
  }
  counts.StockAllocation = allocationSpecs.length;

  // ---------------------------------------------------------------------
  // StockTransfer (4)
  // ---------------------------------------------------------------------
  const transferSpecs = [
    { product: sonyTv, from: mainWh, to: secondaryWh, quantity: 5, status: "completed", notes: "Rebalance after Secondary Storage low-stock alert." },
    { product: ultraBook, from: eastWh, to: westWh, quantity: 10, status: "pending", notes: "West Coast Hub restock ahead of regional promo." },
    { product: deskChair, from: westWh, to: mainWh, quantity: 5, status: "completed", notes: "Consolidating furniture SKUs at Main Warehouse." },
    { product: beats, from: mainWh, to: secondaryWh, quantity: 8, status: "cancelled", notes: "Cancelled — Secondary Storage over capacity this week." },
  ];
  const transfers = [];
  for (const spec of transferSpecs) {
    transfers.push(
      await prisma.stockTransfer.create({
        data: {
          productId: spec.product.id,
          fromWarehouseId: spec.from.id,
          toWarehouseId: spec.to.id,
          quantity: BigInt(spec.quantity),
          status: spec.status,
          notes: spec.notes,
          userId: admin.id,
          createdAt: now,
          completedAt: spec.status === "completed" ? now : null,
        },
      }),
    );
  }
  counts.StockTransfer = transfers.length;

  // ---------------------------------------------------------------------
  // Order + OrderItem + Invoice (6 orders)
  // ---------------------------------------------------------------------
  type OrderLine = { product: typeof beats; warehouse: typeof mainWh; quantity: number; unitPrice: number };
  type OrderSpec = {
    orderNumber: string;
    invoiceNumber: string;
    lines: OrderLine[];
    tax: number;
    shipping: number;
    discount: number;
    status: string;
    paymentStatus: string;
    invoiceStatus: string;
    orderDate: Date;
    notes: string;
    trackingNumber?: string;
    trackingCarrier?: string;
    amountPaid?: number;
    buyer: "client" | "self";
  };

  const orderSpecs: OrderSpec[] = [
    {
      orderNumber: "ORD-DEMO-001",
      invoiceNumber: "INV-DEMO-001",
      lines: [{ product: sonyTv, warehouse: mainWh, quantity: 1, unitPrice: 499 }],
      tax: 35.93,
      shipping: 0,
      discount: 0,
      status: "delivered",
      paymentStatus: "paid",
      invoiceStatus: "paid",
      orderDate: day("2026-06-15T14:00:00.000Z"),
      notes: "Client paid/delivered — buyer clientId.",
      trackingNumber: "DEMO-TRACK-001",
      trackingCarrier: "ups",
      buyer: "client",
    },
    {
      orderNumber: "ORD-DEMO-002",
      invoiceNumber: "INV-DEMO-002",
      lines: [{ product: beats, warehouse: mainWh, quantity: 20, unitPrice: 199 }],
      tax: 0,
      shipping: 0,
      discount: 0,
      status: "confirmed",
      paymentStatus: "partial",
      invoiceStatus: "sent",
      amountPaid: 100,
      orderDate: day("2026-07-15T10:00:00.000Z"),
      notes: "Client partial-paid reserved — Pay remaining / stock allocate QA.",
      buyer: "client",
    },
    {
      orderNumber: "ORD-DEMO-003",
      invoiceNumber: "INV-DEMO-003",
      lines: [{ product: sonyTv, warehouse: secondaryWh, quantity: 1, unitPrice: 499 }],
      tax: 0,
      shipping: 0,
      discount: 0,
      status: "delivered",
      paymentStatus: "paid",
      invoiceStatus: "paid",
      orderDate: day("2026-07-10T12:00:00.000Z"),
      notes: "Admin self-order — clientId null (Self badge).",
      trackingNumber: "DEMO-TRACK-003",
      trackingCarrier: "usps",
      buyer: "self",
    },
    {
      orderNumber: "ORD-DEMO-004",
      invoiceNumber: "INV-DEMO-004",
      lines: [{ product: sonyTv, warehouse: secondaryWh, quantity: 1, unitPrice: 499 }],
      tax: 0,
      shipping: 0,
      discount: 0,
      status: "pending",
      paymentStatus: "unpaid",
      invoiceStatus: "draft",
      orderDate: day("2026-07-18T09:00:00.000Z"),
      notes: "Client unpaid/pending — Client portal + Self/Others QA.",
      buyer: "client",
    },
    {
      orderNumber: "ORD-DEMO-005",
      invoiceNumber: "INV-DEMO-005",
      lines: [
        { product: ultraBook, warehouse: eastWh, quantity: 1, unitPrice: 1299 },
        { product: deskChair, warehouse: westWh, quantity: 2, unitPrice: 249 },
      ],
      tax: 62.33,
      shipping: 25,
      discount: 50,
      status: "processing",
      paymentStatus: "paid",
      invoiceStatus: "paid",
      orderDate: day("2026-08-01T11:30:00.000Z"),
      notes: "Multi-line client order — laptop + 2 desk chairs, bundled discount.",
      trackingNumber: "DEMO-TRACK-005",
      trackingCarrier: "fedex",
      buyer: "client",
    },
    {
      orderNumber: "ORD-DEMO-006",
      invoiceNumber: "INV-DEMO-006",
      lines: [{ product: deskChair, warehouse: mainWh, quantity: 1, unitPrice: 249 }],
      tax: 0,
      shipping: 0,
      discount: 0,
      status: "cancelled",
      paymentStatus: "refunded",
      invoiceStatus: "cancelled",
      orderDate: day("2026-08-05T16:00:00.000Z"),
      notes: "Admin self-order, later cancelled/refunded — cancellation-flow QA.",
      buyer: "self",
    },
  ];

  const orders = [];
  const invoices = [];
  const orderIdByNumber = new Map<string, string>();
  const firstOrderItemIdByNumber = new Map<string, string>();

  for (const spec of orderSpecs) {
    const subtotal = spec.lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
    const total = subtotal + spec.tax + spec.shipping - spec.discount;
    const isSelf = spec.buyer === "self";
    const orderClientId = isSelf ? null : client.id;
    const orderCreatedBy = isSelf ? admin.id : client.id;
    const partyAddress = address({
      name: isSelf ? admin.name : client.name,
      email: isSelf ? admin.email : client.email,
    } as unknown as Record<string, string>);
    const isDelivered = spec.status === "delivered";

    const order = await prisma.order.create({
      data: {
        orderNumber: spec.orderNumber,
        userId: admin.id,
        clientId: orderClientId,
        status: spec.status,
        paymentStatus: spec.paymentStatus,
        subtotal,
        tax: spec.tax > 0 ? spec.tax : null,
        shipping: spec.shipping > 0 ? spec.shipping : null,
        discount: spec.discount > 0 ? spec.discount : null,
        total,
        notes: spec.notes,
        shippingAddress: partyAddress,
        billingAddress: partyAddress,
        trackingNumber: spec.trackingNumber ?? null,
        trackingCarrier: spec.trackingCarrier ?? null,
        trackingUrl: spec.trackingNumber ? `https://example.com/track/${spec.trackingNumber}` : null,
        shippedAt: isDelivered ? spec.orderDate : null,
        deliveredAt: isDelivered ? spec.orderDate : null,
        cancelledAt: spec.status === "cancelled" ? spec.orderDate : null,
        createdBy: orderCreatedBy,
        updatedBy: admin.id,
        createdAt: spec.orderDate,
        updatedAt: spec.orderDate,
        items: {
          create: spec.lines.map((line) => ({
            productId: line.product.id,
            productName: line.product.name,
            sku: line.product.sku,
            quantity: line.quantity,
            price: line.unitPrice,
            subtotal: line.unitPrice * line.quantity,
            warehouseId: line.warehouse.id,
            warehouseName: line.warehouse.name,
            createdAt: spec.orderDate,
          })),
        },
      },
      select: { id: true, items: { select: { id: true }, orderBy: { createdAt: "asc" } } },
    });
    orders.push(order);
    orderIdByNumber.set(spec.orderNumber, order.id);
    if (order.items[0]?.id) firstOrderItemIdByNumber.set(spec.orderNumber, order.items[0].id);

    const dueDate = addDays(spec.orderDate, 30);
    const invoicePaid = spec.invoiceStatus === "paid";
    const amountPaid = invoicePaid ? total : Math.min(total, Math.max(0, spec.amountPaid ?? 0));
    const amountDue = Math.max(0, total - amountPaid);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: spec.invoiceNumber,
        orderId: order.id,
        userId: admin.id,
        clientId: orderClientId,
        status: spec.invoiceStatus,
        subtotal,
        tax: spec.tax > 0 ? spec.tax : null,
        shipping: spec.shipping > 0 ? spec.shipping : null,
        discount: spec.discount > 0 ? spec.discount : null,
        total,
        amountPaid,
        amountDue,
        dueDate,
        issuedAt: spec.orderDate,
        sentAt: spec.invoiceStatus === "draft" ? null : spec.orderDate,
        paidAt: invoicePaid ? spec.orderDate : null,
        cancelledAt: spec.invoiceStatus === "cancelled" ? spec.orderDate : null,
        notes: `Demo invoice for ${spec.orderNumber}`,
        billingAddress: partyAddress,
        createdBy: admin.id,
        updatedBy: admin.id,
        createdAt: spec.orderDate,
        updatedAt: spec.orderDate,
      },
    });
    invoices.push(invoice);
  }
  counts.Order = orders.length;
  counts.OrderItem = orderSpecs.reduce((sum, spec) => sum + spec.lines.length, 0);
  counts.Invoice = invoices.length;

  // ---------------------------------------------------------------------
  // SupportTicket (4) + SupportTicketReply (5)
  // ---------------------------------------------------------------------
  const ticketSpecs = [
    {
      subject: "Beats delivery question",
      description: "Client demo ticket: when will ORD-DEMO-002 ship after payment?",
      status: "open",
      priority: "medium",
      productId: beats.id,
      replies: [] as string[],
    },
    {
      subject: "TV packaging damage report",
      description: "Admin-assigned ticket with a reply for support UI explore.",
      status: "in_progress",
      priority: "high",
      productId: sonyTv.id,
      replies: ["Thanks for reporting — we opened a replacement case. Reply from Test Admin."],
    },
    {
      subject: "UltraBook warranty inquiry",
      description: "Client asking whether the 14-inch model includes accidental-damage cover.",
      status: "resolved",
      priority: "low",
      productId: ultraBook.id,
      replies: [
        "Good news — the Pro 14 ships with a 1-year accidental damage warranty.",
        "Client confirmed — closing out as resolved.",
      ],
    },
    {
      subject: "Desk chair missing hardware",
      description: "Chair arrived without the armrest mounting screws.",
      status: "closed",
      priority: "urgent",
      productId: deskChair.id,
      replies: ["Replacement hardware kit shipped via 2-day mail — tracking sent by email."],
    },
  ];
  const tickets = [];
  let replyCount = 0;
  for (const spec of ticketSpecs) {
    const ticket = await prisma.supportTicket.create({
      data: {
        subject: spec.subject,
        description: spec.description,
        status: spec.status,
        priority: spec.priority,
        userId: client.id,
        assignedToId: admin.id,
        productId: spec.productId,
        notes: "Demo ticket seed",
        createdAt: now,
        updatedAt: now,
        replies: spec.replies.length
          ? { create: spec.replies.map((body) => ({ userId: admin.id, body, createdAt: now })) }
          : undefined,
      },
    });
    tickets.push(ticket);
    replyCount += spec.replies.length;
  }
  counts.SupportTicket = tickets.length;
  counts.SupportTicketReply = replyCount;

  // ---------------------------------------------------------------------
  // ProductReview (4)
  // ---------------------------------------------------------------------
  const reviewSpecs = [
    { product: sonyTv, orderNumber: "ORD-DEMO-001", rating: 5, comment: "Great picture quality — demo approved review.", status: "approved" },
    { product: beats, orderNumber: "ORD-DEMO-002", rating: 4, comment: "Comfortable fit — pending moderation demo review.", status: "pending" },
    { product: ultraBook, orderNumber: "ORD-DEMO-005", rating: 5, comment: "Fast, light, great battery life for the price.", status: "approved" },
    { product: deskChair, orderNumber: "ORD-DEMO-006", rating: 2, comment: "Armrest broke within a week — rejected pending vendor review.", status: "rejected" },
  ];
  const reviews = [];
  for (const spec of reviewSpecs) {
    const orderId = orderIdByNumber.get(spec.orderNumber);
    const orderItemId = firstOrderItemIdByNumber.get(spec.orderNumber);
    if (!orderId) throw new Error(`Full demo seed: order not found for review ${spec.orderNumber}`);
    reviews.push(
      await prisma.productReview.create({
        data: {
          productId: spec.product.id,
          userId: client.id,
          orderId,
          orderItemId: orderItemId ?? null,
          productName: spec.product.name,
          productSku: spec.product.sku,
          rating: spec.rating,
          comment: spec.comment,
          status: spec.status,
          createdAt: now,
          updatedAt: now,
        },
      }),
    );
  }
  counts.ProductReview = reviews.length;

  // ---------------------------------------------------------------------
  // Notification (6)
  // ---------------------------------------------------------------------
  const notificationSpecs = [
    { userId: admin.id, type: "order_status_update", title: "New client order", message: "ORD-DEMO-002 is pending payment (20x Beats).", link: "/orders", read: false },
    { userId: client.id, type: "invoice_sent", title: "Invoice ready", message: "INV-DEMO-002 was sent for your pending Beats order.", link: "/invoices", read: false },
    { userId: supplierUser.id, type: "low_stock", title: "Allocation reserved", message: "Beats (SK56) has 20 units reserved on Main Warehouse.", link: "/products", read: true },
    { userId: admin.id, type: "low_stock", title: "Low stock alert", message: "Oakwood Desk Chair (FN12) is below the low-stock threshold.", link: "/products", read: false },
    { userId: client.id, type: "order_status_update", title: "Order shipped", message: "ORD-DEMO-005 has shipped via FedEx.", link: "/orders", read: true },
    { userId: supplierUser.id, type: "order_status_update", title: "New purchase needed", message: "UltraBook Pro 14 (LP89) is running low across warehouses.", link: "/products", read: false },
  ];
  const notifications = [];
  for (const spec of notificationSpecs) {
    notifications.push(
      await prisma.notification.create({
        data: {
          userId: spec.userId,
          type: spec.type,
          title: spec.title,
          message: spec.message,
          link: spec.link,
          read: spec.read,
          readAt: spec.read ? now : null,
          createdAt: now,
          metadata: { source: "full-demo-seed" } as Prisma.InputJsonValue,
        },
      }),
    );
  }
  counts.Notification = notifications.length;

  // ---------------------------------------------------------------------
  // ImportHistory (4)
  // ---------------------------------------------------------------------
  const importSpecs = [
    { importType: "products", fileName: "demo-products.csv", fileSize: 2048, totalRows: 4, successRows: 4, failedRows: 0, status: "completed" },
    { importType: "categories", fileName: "demo-categories.csv", fileSize: 512, totalRows: 4, successRows: 3, failedRows: 1, status: "completed" },
    { importType: "suppliers", fileName: "demo-suppliers.csv", fileSize: 640, totalRows: 4, successRows: 0, failedRows: 4, status: "failed" },
    { importType: "orders", fileName: "demo-orders.csv", fileSize: 1536, totalRows: 6, successRows: 0, failedRows: 0, status: "processing" },
  ];
  const imports = [];
  for (const spec of importSpecs) {
    imports.push(
      await prisma.importHistory.create({
        data: {
          userId: admin.id,
          importType: spec.importType,
          fileName: spec.fileName,
          fileSize: spec.fileSize,
          totalRows: spec.totalRows,
          successRows: spec.successRows,
          failedRows: spec.failedRows,
          errors: spec.failedRows > 0 ? (["Row 2: demo validation error"] as unknown as Prisma.InputJsonValue) : undefined,
          status: spec.status,
          createdAt: now,
          completedAt: spec.status === "processing" ? null : now,
        },
      }),
    );
  }
  counts.ImportHistory = imports.length;

  // ---------------------------------------------------------------------
  // SystemConfig (5)
  // ---------------------------------------------------------------------
  const systemConfigSpecs = [
    { key: "company_name", value: "Octalve IMS Demo", type: "string", label: "Company name", description: "Display name for invoices and emails.", category: "general", isPublic: true },
    { key: "low_stock_threshold", value: "10", type: "number", label: "Low stock threshold", description: "Alert when available qty falls at or below this value.", category: "notifications", isPublic: false },
    { key: "default_tax_rate", value: "7.25", type: "number", label: "Default tax rate (%)", description: "Applied to new orders unless overridden.", category: "payment", isPublic: false },
    { key: "default_currency", value: "USD", type: "string", label: "Default currency", description: "Currency code used on invoices and reports.", category: "general", isPublic: true },
    { key: "enable_email_notifications", value: "true", type: "boolean", label: "Email notifications", description: "Master switch for outbound transactional email.", category: "email", isPublic: false },
  ];
  const systemConfigs = [];
  for (const spec of systemConfigSpecs) {
    systemConfigs.push(
      await prisma.systemConfig.create({
        data: {
          key: spec.key,
          value: spec.value,
          type: spec.type,
          label: spec.label,
          description: spec.description,
          category: spec.category,
          isPublic: spec.isPublic,
          createdAt: now,
          updatedAt: now,
          updatedBy: admin.id,
        },
      }),
    );
  }
  counts.SystemConfig = systemConfigs.length;

  // ---------------------------------------------------------------------
  // AuditLog (6)
  // ---------------------------------------------------------------------
  const auditSpecs = [
    { userId: admin.id, action: "create", entityType: "product", entityId: beats.id, details: { sku: "SK56", name: "Beats", source: "full-demo-seed" } },
    { userId: admin.id, action: "create", entityType: "order", entityId: orderIdByNumber.get("ORD-DEMO-002"), details: { orderNumber: "ORD-DEMO-002", source: "full-demo-seed" } },
    { userId: admin.id, action: "update", entityType: "order", entityId: orderIdByNumber.get("ORD-DEMO-006"), details: { orderNumber: "ORD-DEMO-006", change: "status -> cancelled" } },
    { userId: client.id, action: "login", entityType: "user", entityId: client.id, details: { method: "credentials" } },
    { userId: admin.id, action: "update", entityType: "invoice", entityId: invoices.find((i) => i.invoiceNumber === "INV-DEMO-006")?.id, details: { invoiceNumber: "INV-DEMO-006", change: "status -> cancelled" } },
    { userId: supplierUser.id, action: "login", entityType: "user", entityId: supplierUser.id, details: { method: "credentials" } },
  ];
  const audits = [];
  for (const spec of auditSpecs) {
    audits.push(
      await prisma.auditLog.create({
        data: {
          userId: spec.userId,
          action: spec.action,
          entityType: spec.entityType,
          entityId: spec.entityId ?? null,
          details: spec.details as Prisma.InputJsonValue,
          ipAddress: "127.0.0.1",
          userAgent: "full-demo-seed/1.0",
          createdAt: now,
        },
      }),
    );
  }
  counts.AuditLog = audits.length;

  // ---------------------------------------------------------------------
  // RefreshToken (4)
  // ---------------------------------------------------------------------
  const refreshTokenSpecs = [
    { user: admin, revoked: false },
    { user: client, revoked: false },
    { user: supplierUser, revoked: true },
    { user: retailer, revoked: false },
  ];
  let refreshTokenCount = 0;
  for (const spec of refreshTokenSpecs) {
    await prisma.refreshToken.create({
      data: {
        userId: spec.user.id,
        tokenHash: randomHash(),
        familyId: randomHash(),
        revokedAt: spec.revoked ? now : null,
        replacedBy: spec.revoked ? randomHash() : null,
        expiresAt: addDays(now, 30),
        createdAt: now,
      },
    });
    refreshTokenCount++;
  }
  counts.RefreshToken = refreshTokenCount;

  // ---------------------------------------------------------------------
  // VerificationToken (4 — one per business-scoped user, unique per user)
  // ---------------------------------------------------------------------
  let verificationTokenCount = 0;
  for (const user of businessUsers) {
    await prisma.verificationToken.create({
      data: {
        userId: user.id,
        tokenHash: randomHash(),
        expiresAt: addDays(now, 1),
        createdAt: now,
      },
    });
    verificationTokenCount++;
  }
  counts.VerificationToken = verificationTokenCount;

  // ---------------------------------------------------------------------
  // LoginAttempt (4)
  // ---------------------------------------------------------------------
  const loginAttemptSpecs = [
    { identifier: `login:127.0.0.1:${admin.email}`, userId: admin.id },
    { identifier: `login:203.0.113.5:${client.email}`, userId: client.id },
    { identifier: "register:198.51.100.9", userId: null },
    { identifier: `refresh:192.0.2.15:${supplierUser.email}`, userId: supplierUser.id },
  ];
  let loginAttemptCount = 0;
  for (const spec of loginAttemptSpecs) {
    await prisma.loginAttempt.create({
      data: { identifier: spec.identifier, userId: spec.userId, createdAt: now },
    });
    loginAttemptCount++;
  }
  counts.LoginAttempt = loginAttemptCount;

  return counts;
}

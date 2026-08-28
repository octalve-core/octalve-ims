/**
 * Centralized type exports
 * Re-export all types from organized type files
 */

// Product types
export type {
  Product,
  ProductStatus,
  CreateProductInput,
  UpdateProductInput,
} from "./product";

// Category types
export type {
  Category,
  CreateCategoryInput,
  UpdateCategoryInput,
} from "./category";

// Supplier types
export type {
  Supplier,
  CreateSupplierInput,
  UpdateSupplierInput,
} from "./supplier";

// Warehouse types
export type {
  Warehouse,
  CreateWarehouseInput,
  UpdateWarehouseInput,
} from "./warehouse";

// Auth types
export type {
  User,
  AuthContextType,
  LoginInput,
  RegisterInput,
  LoginResponse,
  EmailNotificationType,
  EmailPreferences,
  UpdateEmailPreferencesInput,
  DEFAULT_EMAIL_PREFERENCES,
} from "./auth";

// Order types
export type {
  Order,
  OrderItem,
  OrderStatus,
  PaymentStatus,
  ShippingAddress,
  BillingAddress,
  CreateOrderInput,
  UpdateOrderInput,
  OrderFilters,
} from "./order";

// Notification types
export type {
  Notification,
  NotificationType,
  NotificationMetadata,
  CreateNotificationInput,
  UpdateNotificationInput,
  NotificationFilters,
} from "./notification";

// Invoice types
export type {
  Invoice,
  InvoiceStatus,
  CreateInvoiceInput,
  UpdateInvoiceInput,
  InvoiceFilters,
} from "./invoice";

// Dashboard (admin overview) types
export type {
  DashboardStats,
  DashboardCounts,
  DashboardRevenue,
  DashboardTrendPoint,
  DashboardRecent,
  DashboardRecentOrder,
  DashboardRecentTicket,
  DashboardRecentReview,
  DashboardRecentImport,
  DashboardOrderAnalytics,
  DashboardOrderStatusDist,
  DashboardTopProduct,
  DashboardInvoiceAnalytics,
  DashboardInvoiceStatusDist,
  DashboardWarehouseAnalytics,
  DashboardProductStatusBreakdown,
  DashboardUserRoleBreakdown,
  DashboardSupplierStatusBreakdown,
  DashboardCategoryStatusBreakdown,
  DashboardTicketStatusBreakdown,
  DashboardReviewStatusBreakdown,
  DashboardSelfOthersBreakdown,
} from "./dashboard";

// Stock Allocation types
export type {
  StockTransferStatus,
  StockAllocation,
  StockTransfer,
  CreateStockAllocationInput,
  UpdateStockAllocationInput,
  CreateStockTransferInput,
  WarehouseStockSummary,
} from "./stock-allocation";

// User Management (admin) types
export type {
  UserForAdmin,
  UserOverview,
  UserRole,
  UpdateUserAdminInput,
  CreateUserAdminInput,
  UserManagementFilters,
} from "./user-management";

// Audit Log types (createAuditLog is called from core CRUD routes for audit
// trail; only the browse/filter UI in getAuditLogs is Pro-gated)
export type {
  AuditAction,
  AuditEntityType,
  AuditLog,
  CreateAuditLogInput,
  AuditLogFilters,
} from "./audit-log";

// Portal types (client/supplier self-view within the shared order/invoice/
// product lists is core-tier; only the dedicated /client, /supplier admin
// portal apps are Pro/Premium-gated)
export type {
  SupplierPortalDashboard,
  ClientPortalDashboard,
  ClientCatalogOverview,
  ClientBrowseMeta,
  ClientBrowseProductsResponse,
  PortalUser,
} from "./portal";

// Forecasting types (useForecastingSummary is already core-bucketed and
// used unconditionally by CategoryDetailPage.core.tsx/SupplierDetailPage.core.tsx/
// WarehouseDetailPage.core.tsx; the premium-exclusive rollup computation
// lives in lib/forecasting/, untouched)
export type {
  ProductSalesHistory,
  ProductDemandForecast,
  SalesAnomaly,
  ForecastingSummary,
  TrendAnalysis,
} from "./forecasting";

// API types (AdminCounts for admin sidebar counts)
export type { AdminCounts } from "./api";

// Re-export email types (InvoiceEmailData is in lib/email/types.ts, not types/)
export type { InvoiceEmailData } from "@/lib/email/types";

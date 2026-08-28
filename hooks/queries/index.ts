/**
 * Query hooks exports
 * Centralized export point for all TanStack Query hooks
 */

// Product hooks
export {
  useProducts,
  useProduct,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
} from "./use-products";

// Category hooks
export {
  useCategories,
  useCategory,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from "./use-categories";

// Supplier hooks
export {
  useSuppliers,
  useSupplier,
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
} from "./use-suppliers";

// Warehouse hooks
export {
  useWarehouses,
  useWarehouse,
  useCreateWarehouse,
  useUpdateWarehouse,
  useDeleteWarehouse,
} from "./use-warehouses";

// Order hooks
export {
  useOrders,
  useOrder,
  useClientOrders,
  useCreateOrder,
  useUpdateOrder,
  useDeleteOrder,
} from "./use-orders";

// Notification hooks
export {
  useNotifications,
  useUnreadNotificationCount,
  useNotification,
  useUpdateNotification,
  useMarkAllNotificationsAsRead,
  useDeleteNotification,
} from "./use-notifications";

// Invoice hooks
export {
  useInvoices,
  useInvoice,
  useClientInvoices,
  useCreateInvoice,
  useUpdateInvoice,
  useDeleteInvoice,
  useSendInvoice,
} from "./use-invoices";

// Dashboard (admin overview) hooks
export { useDashboard } from "./use-dashboard";

// User Management (admin) hooks
export {
  useUsers,
  useUser,
  useUpdateUser,
  useCreateUser,
  useDeleteUser,
} from "./use-user-management";

export { useOrderLineStockValidation } from "../use-order-line-stock-validation";

// Forecasting hooks
export { useForecastingSummary } from "./use-forecasting";

// Auth hooks
export { useSession, useLogin, useRegister, useLogout } from "./use-auth";

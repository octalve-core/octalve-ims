/**
 * User Management (admin) validation schemas
 */

import { z } from "zod";

const userRoleEnum = z.enum([
  "user",
  "admin",
  "supplier",
  "client",
  "retailer",
]);

export const updateUserAdminSchema = z.object({
  role: userRoleEnum.nullable().optional(),
  name: z.string().min(1, "Name is required").max(200).optional(),
  // ISS-0102 — the only two states an admin may set; PENDING_VERIFICATION is
  // reached only by self-registration.
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
});

export const createUserAdminSchema = z.object({
  email: z.string().email("Valid email is required"),
  name: z.string().min(1, "Name is required").max(200),
  password: z.string().min(8, "Password must be at least 8 characters"),
  // ISS-0095 — `.optional()` only ever let `undefined` through, never an
  // empty string; the form's own defaultValues seed `""`, and a person who
  // types then clears the field leaves `""` behind too, not `undefined`.
  // The field is genuinely optional at the data layer (prisma/user-admin.ts
  // stores `data.username || null`), so blank must mean "not provided"
  // here, not "a 3-character minimum was violated."
  username: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().min(3).max(50).optional(),
  ),
  role: userRoleEnum.nullable().optional(),
});

export type UpdateUserAdminFormData = z.infer<typeof updateUserAdminSchema>;
export type CreateUserAdminFormData = z.infer<typeof createUserAdminSchema>;

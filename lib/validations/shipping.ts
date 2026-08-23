/**
 * Shipping API validation schemas (Shippo-aligned addresses)
 */

import { z } from "zod";

export const shippoAddressSchema = z.object({
  name: z.string().optional(),
  street1: z.string().min(1, "Street address is required"),
  street2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zip: z.string().min(1, "Zip code is required"),
  country: z.string().min(1, "Country is required").default("US"),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
});

export const parcelDimensionsSchema = z.object({
  length: z.string().min(1),
  width: z.string().min(1),
  height: z.string().min(1),
  weight: z.string().min(1),
});

export const getRatesBodySchema = z.object({
  toAddress: shippoAddressSchema,
  fromAddress: shippoAddressSchema.optional(),
  parcel: parcelDimensionsSchema.optional(),
});

export const generateLabelBodySchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  carrier: z.enum(["usps", "ups", "fedex", "dhl", "other"]).optional(),
  service: z.string().optional(),
  rateObjectId: z.string().optional(),
  fromAddress: shippoAddressSchema.optional(),
  toAddress: shippoAddressSchema.optional(),
  parcel: parcelDimensionsSchema.optional(),
});

export const addTrackingBodySchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  trackingNumber: z.string().min(1, "Tracking number is required"),
  trackingCarrier: z
    .enum(["usps", "ups", "fedex", "dhl", "other"])
    .optional(),
});

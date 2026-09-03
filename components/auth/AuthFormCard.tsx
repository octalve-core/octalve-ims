"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { AuthGlassVariant } from "@/components/auth/auth-glass-styles";

type AuthFormCardProps = {
  variant: AuthGlassVariant;
  children: ReactNode;
  className?: string;
};

/**
 * REQ-0231 — Suite Portal reskin: the form sits directly on the page (no
 * frosted card wrapper) matching AuthShell — `variant` is kept only so
 * callers don't need to change, it no longer affects styling.
 */
export function AuthFormCard({ children, className }: AuthFormCardProps) {
  return <div className={cn("w-full", className)}>{children}</div>;
}

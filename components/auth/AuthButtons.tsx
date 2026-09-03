"use client";

import type React from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AUTH_GOOGLE_BUTTON_CLASS,
  AUTH_PRIMARY_BUTTON_CLASS,
  type AuthGlassVariant,
} from "@/components/auth/auth-glass-styles";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09A6.6 6.6 0 0 1 5.49 12c0-.73.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.43 3.45 1.18 4.93l2.85-2.22.81-.62Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"
        fill="#EA4335"
      />
    </svg>
  );
}

/** REQ-0231 — Suite Portal reskin: solid #0064E0 submit button + trailing arrow. */
export function AuthPrimaryButton({
  children,
  loading,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={cn(AUTH_PRIMARY_BUTTON_CLASS, "cursor-pointer", className)}
    >
      <span>{children}</span>
      {loading ? (
        <Loader2 size={18} className="animate-spin" />
      ) : (
        <ArrowRight
          size={18}
          strokeWidth={2.1}
          className="transition group-hover:translate-x-0.5"
        />
      )}
    </button>
  );
}

export function AuthGoogleButton({
  variant,
  loading,
  children,
  onClick,
}: {
  variant: AuthGlassVariant;
  loading?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={loading}
      onClick={onClick}
      className={cn(AUTH_GOOGLE_BUTTON_CLASS[variant], "cursor-pointer")}
    >
      <GoogleIcon />
      <span>{children}</span>
    </button>
  );
}

export function AuthDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4 py-1 text-center text-[12px] font-medium uppercase text-slate-400 dark:text-white/40">
      <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
      <span>{label}</span>
      <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
    </div>
  );
}

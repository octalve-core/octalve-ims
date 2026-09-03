/**
 * REQ-0231 — Suite Portal reskin: flat, bordered field/button tokens
 * matching octalve-suite-portal's AuthFields/AuthButtons (rounded-2xl,
 * h-14 inputs, single #0064E0 accent for both login and register — Suite
 * Portal doesn't split its accent by auth mode the way the old glass
 * design did). Dark-mode variants are IMS's own extrapolation since the
 * source design has no dark mode.
 */

export type AuthGlassVariant = "login" | "register";

/** Shared input/select field shell — icon-left, border, focus ring. */
export const AUTH_FIELD_SHELL_CLASS =
  "flex h-14 w-full items-center gap-3 rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-white/[0.04] px-4 text-[15px] font-medium text-slate-950 dark:text-white shadow-[0_1px_0_rgba(15,23,42,0.03)] transition placeholder:text-slate-400 dark:placeholder:text-white/35 focus-within:border-[#0064E0] focus-within:shadow-[0_0_0_4px_rgba(0,100,224,0.12)]";

/** Role test-account Select trigger — same shell as text inputs. */
export const AUTH_SELECT_FIELD_CLASS = `${AUTH_FIELD_SHELL_CLASS} gap-2 data-[state=open]:border-[#0064E0] data-[state=open]:shadow-[0_0_0_4px_rgba(0,100,224,0.12)]`;

/** Primary submit button — solid #0064E0, both auth modes. */
export const AUTH_PRIMARY_BUTTON_CLASS =
  "group flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-[#0064E0] px-6 text-[15px] font-semibold text-white shadow-[0_18px_36px_rgba(0,100,224,0.20)] transition hover:-translate-y-0.5 hover:bg-[#0052B8] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0";

/** Google OAuth button — bordered, plain white/slate — both auth modes. */
export const AUTH_GOOGLE_BUTTON_CLASS: Record<AuthGlassVariant, string> =
  {
    login:
      "flex h-[52px] w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-white/[0.04] px-5 text-[14px] font-semibold text-slate-700 dark:text-white shadow-[0_8px_20px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-white/25 hover:bg-slate-50 dark:hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0",
    register:
      "flex h-[52px] w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-white/[0.04] px-5 text-[14px] font-semibold text-slate-700 dark:text-white shadow-[0_8px_20px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-white/25 hover:bg-slate-50 dark:hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0",
  };

/** Rows within the navy side panel (feature list) — micro-glass on dark. */
export const AUTH_LIST_ROW_GLASS =
  "flex gap-3 rounded-2xl border border-white/10 bg-white/[0.05] backdrop-blur-md px-3.5 py-2.5";

import type { AuthListHue } from "@/lib/auth/auth-panel-copy";

/**
 * REQ-0231 — icon pill styles for the navy side-panel feature list. Flat
 * white-on-navy icon wraps (no per-hue gradient glass) since the source
 * panel's own accents are just solid white/blue, not a rainbow of hues —
 * the hue is kept only as a subtle icon-color accent.
 */
export const AUTH_LIST_ICON_STYLES: Record<
  AuthListHue,
  { wrap: string; icon: string }
> = {
  sky: {
    wrap: "border-white/15 bg-white/10",
    icon: "text-sky-300",
  },
  emerald: {
    wrap: "border-white/15 bg-white/10",
    icon: "text-emerald-300",
  },
  amber: {
    wrap: "border-white/15 bg-white/10",
    icon: "text-amber-300",
  },
  violet: {
    wrap: "border-white/15 bg-white/10",
    icon: "text-violet-300",
  },
  blue: {
    wrap: "border-white/15 bg-white/10",
    icon: "text-[#5ea1ff]",
  },
};

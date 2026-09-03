"use client";

import Link from "next/link";
import { Boxes } from "lucide-react";
import { AuthAnimatedBlock } from "@/components/auth/AuthAnimatedBlock";

/**
 * REQ-0231 — Suite Portal reskin: plain, larger brand lockup matching the
 * scale of Suite Portal's AuthBrand (a 150px-wide logo image). IMS has no
 * equivalent logo asset, so this keeps the existing icon+wordmark pattern
 * but sized up and de-gradiented to match Suite Portal's flatter, plainer
 * brand treatment instead of the old glass/gradient rose box.
 */
export function AuthBrandHeader() {
  return (
    <AuthAnimatedBlock delayMs={0}>
      <Link
        href="/"
        className="group inline-flex items-center gap-3 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#0064E0]/50"
        aria-label="Octalve IMS: Inventory Management System"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0064E0] text-white shadow-[0_10px_24px_rgba(0,100,224,0.28)]">
          <Boxes className="h-[22px] w-[22px]" strokeWidth={2.1} />
        </div>
        <div className="min-w-0 text-left">
          <p className="text-[20px] font-bold leading-tight tracking-tight text-[#111827] dark:text-white">
            Octalve IMS
          </p>
          <p className="text-[13px] font-medium leading-tight text-slate-500 dark:text-white/60">
            Inventory Management
          </p>
        </div>
      </Link>
    </AuthAnimatedBlock>
  );
}

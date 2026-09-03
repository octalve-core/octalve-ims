"use client";

import type { ReactNode } from "react";
import { SafeImage } from "@/components/ui/safe-image";
import { AuthBrandHeader } from "@/components/auth/AuthBrandHeader";
import { AuthAnimatedBlock } from "@/components/auth/AuthAnimatedBlock";

type AuthPageShellProps = {
  illustrationSrc: string;
  illustrationAlt: string;
  title: string;
  subtitle: string;
  /** Navy side panel content — role/feature list (AuthInfoPanel). */
  left: ReactNode;
  /** Form column content. */
  right: ReactNode;
};

/**
 * REQ-0231 — Suite Portal reskin: white page, form column (brand + big
 * title/subtitle + form) on the left, rounded navy side panel on the
 * right — matches octalve-suite-portal's AuthShell/AuthSidePanel split
 * exactly at the layout level. The side panel has no equivalent photo
 * asset in this app, so the illustration renders faded behind the panel's
 * content instead of as a full-bleed cover photo.
 * REQ-0033 / REQ-0216 — auth-page-root marker kept (document scroll).
 */
export function AuthPageShell({
  illustrationSrc,
  illustrationAlt,
  title,
  subtitle,
  left,
  right,
}: AuthPageShellProps) {
  return (
    <main className="auth-page-root min-h-screen bg-white text-slate-950 dark:bg-[hsl(var(--background))] dark:text-white">
      <div className="grid min-h-screen gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(400px,0.82fr)_minmax(480px,1.18fr)]">
        <section className="flex min-h-[calc(100vh-24px)] items-center justify-center px-2 py-8 sm:px-8 sm:py-10 lg:min-h-[calc(100vh-32px)] lg:px-10">
          <div className="w-full max-w-[430px]">
            <div className="mb-10 flex justify-center lg:justify-start">
              <AuthBrandHeader />
            </div>

            <AuthAnimatedBlock delayMs={40}>
              <h1 className="text-[32px] font-semibold leading-none tracking-[-0.05em] text-[#111827] dark:text-white sm:text-[38px] lg:text-[42px]">
                {title}
              </h1>
              <p className="mt-4 text-[15px] font-medium leading-7 text-slate-500 dark:text-white/60 sm:text-[17px]">
                {subtitle}
              </p>
            </AuthAnimatedBlock>

            <div className="mt-8">{right}</div>
          </div>
        </section>

        <aside className="relative hidden overflow-hidden rounded-[32px] bg-[hsl(var(--sidebar-ink))] lg:block">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.07]"
          >
            <div className="relative h-[70%] w-[70%]">
              <SafeImage
                src={illustrationSrc}
                alt={illustrationAlt}
                fill
                className="object-contain object-center brightness-0 invert"
                priority
              />
            </div>
          </div>

          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_16%,rgba(0,100,224,0.20),transparent_34%),radial-gradient(circle_at_85%_80%,rgba(0,100,224,0.18),transparent_34%)]" />

          <div className="relative z-10 flex h-full flex-col p-8 xl:p-10">{left}</div>
        </aside>
      </div>
    </main>
  );
}

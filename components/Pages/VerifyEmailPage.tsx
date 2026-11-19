"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { AuthInfoPanel } from "@/components/auth/AuthInfoPanel";
import { AuthFormCard } from "@/components/auth/AuthFormCard";
import { AuthAnimatedBlock } from "@/components/auth/AuthAnimatedBlock";
import { AUTH_FORM_STAGGER_BASE } from "@/components/auth/auth-animation";

/**
 * Verify-email consume page. Reads the emailed `?token=` and submits it (no password — that
 * branch is the separate invite/activation flow this same API route also serves) to
 * /api/auth/verify-email on mount. Decision (a): this is what moves a self-registered account
 * from PENDING_VERIFICATION to ACTIVE.
 */
export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  // No token to check is an immediately-known "invalid" state, not something the effect
  // below needs to set — avoids a setState-in-effect render cascade for that case.
  const [status, setStatus] = useState<"checking" | "success" | "invalid">(
    token ? "checking" : "invalid",
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (cancelled) return;
        setStatus(res.ok ? "success" : "invalid");
        if (res.ok) {
          setTimeout(() => router.push("/login"), 2000);
        }
      } catch {
        if (!cancelled) setStatus("invalid");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  const leftPanel = <AuthInfoPanel variant="login" />;

  let formBody: React.ReactNode;
  if (status === "checking") {
    formBody = (
      <div className="grid gap-5 text-center">
        <AuthAnimatedBlock className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#EAF3FF] text-[#0064E0] dark:bg-white/10 dark:text-[#5ea1ff]">
          <Loader2 size={28} strokeWidth={2} className="animate-spin" />
        </AuthAnimatedBlock>
        <AuthAnimatedBlock delayMs={AUTH_FORM_STAGGER_BASE} className="space-y-2">
          <p className="text-[17px] font-semibold text-slate-900 dark:text-white">
            Verifying your email…
          </p>
        </AuthAnimatedBlock>
      </div>
    );
  } else if (status === "success") {
    formBody = (
      <div className="grid gap-5 text-center">
        <AuthAnimatedBlock className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#EAF3FF] text-[#0064E0] dark:bg-white/10 dark:text-[#5ea1ff]">
          <CheckCircle2 size={28} strokeWidth={2} />
        </AuthAnimatedBlock>
        <AuthAnimatedBlock delayMs={AUTH_FORM_STAGGER_BASE} className="space-y-2">
          <p className="text-[17px] font-semibold text-slate-900 dark:text-white">
            Email verified
          </p>
          <p className="text-[15px] font-medium leading-6 text-slate-500 dark:text-white/60">
            Redirecting you to sign in…
          </p>
        </AuthAnimatedBlock>
      </div>
    );
  } else {
    formBody = (
      <div className="grid gap-5 text-center">
        <AuthAnimatedBlock className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400">
          <XCircle size={28} strokeWidth={2} />
        </AuthAnimatedBlock>
        <AuthAnimatedBlock delayMs={AUTH_FORM_STAGGER_BASE} className="space-y-2">
          <p className="text-[17px] font-semibold text-slate-900 dark:text-white">
            Link invalid or expired
          </p>
          <p className="text-[15px] font-medium leading-6 text-slate-500 dark:text-white/60">
            This verification link is no longer valid. Sign in to check your account&apos;s
            status, or contact an administrator for help.
          </p>
        </AuthAnimatedBlock>
        <AuthAnimatedBlock delayMs={AUTH_FORM_STAGGER_BASE * 2} className="pt-2">
          <Link
            href="/login"
            className="text-sm font-semibold text-[#0064E0] transition hover:text-[#0052B8] dark:text-[#5ea1ff]"
          >
            Go to sign in
          </Link>
        </AuthAnimatedBlock>
      </div>
    );
  }

  return (
    <AuthPageShell
      illustrationSrc="/octalve-ims.svg"
      illustrationAlt="Octalve IMS Illustration"
      title="Verify email"
      subtitle="Confirming your Octalve IMS account."
      left={leftPanel}
      right={
        <AuthAnimatedBlock delayMs={AUTH_FORM_STAGGER_BASE} className="w-full">
          <AuthFormCard variant="login" className="w-full">
            {formBody}
          </AuthFormCard>
        </AuthAnimatedBlock>
      }
    />
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, CheckCircle2 } from "lucide-react";
import { AuthFieldInput } from "@/components/auth/AuthFieldInput";
import { AuthPrimaryButton } from "@/components/auth/AuthButtons";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { AuthInfoPanel } from "@/components/auth/AuthInfoPanel";
import { AuthFormCard } from "@/components/auth/AuthFormCard";
import { AuthAnimatedBlock } from "@/components/auth/AuthAnimatedBlock";
import {
  AUTH_FORM_ROW_STAGGER_MS,
  AUTH_FORM_STAGGER_BASE,
} from "@/components/auth/auth-animation";
import { useToast } from "@/hooks/use-toast";

/**
 * Forgot-password request page. Submits an email to
 * /api/auth/forgot-password and always shows the same "check your email"
 * success state (the API deliberately never reveals whether an account
 * exists for the address).
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const formRowDelay = (row: number) =>
    AUTH_FORM_STAGGER_BASE + row * AUTH_FORM_ROW_STAGGER_MS;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong. Please try again.");
      }
      setSubmitted(true);
    } catch (error) {
      toast({
        title: "Request Failed",
        description:
          error instanceof Error
            ? error.message
            : "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const leftPanel = <AuthInfoPanel variant="login" />;

  const rightPanel = (
    <AuthAnimatedBlock delayMs={AUTH_FORM_STAGGER_BASE} className="w-full">
      <AuthFormCard variant="login" className="w-full">
        {submitted ? (
          <div className="grid gap-5 text-center">
            <AuthAnimatedBlock
              delayMs={formRowDelay(0)}
              className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#EAF3FF] text-[#0064E0] dark:bg-white/10 dark:text-[#5ea1ff]"
            >
              <CheckCircle2 size={28} strokeWidth={2} />
            </AuthAnimatedBlock>
            <AuthAnimatedBlock delayMs={formRowDelay(1)} className="space-y-2">
              <p className="text-[17px] font-semibold text-slate-900 dark:text-white">
                Check your email
              </p>
              <p className="text-[15px] font-medium leading-6 text-slate-500 dark:text-white/60">
                If an account exists for <span className="font-semibold text-slate-700 dark:text-white/80">{email}</span>,
                we&apos;ve sent a link to reset your password. It expires in 60
                minutes.
              </p>
            </AuthAnimatedBlock>
            <AuthAnimatedBlock delayMs={formRowDelay(2)} className="pt-2">
              <Link
                href="/login"
                className="text-sm font-semibold text-[#0064E0] transition hover:text-[#0052B8] dark:text-[#5ea1ff]"
              >
                Back to sign in
              </Link>
            </AuthAnimatedBlock>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-5">
            <AuthAnimatedBlock delayMs={formRowDelay(0)}>
              <AuthFieldInput
                label="Email"
                icon={<Mail size={18} strokeWidth={2} />}
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                disabled={isLoading}
              />
            </AuthAnimatedBlock>

            <AuthAnimatedBlock delayMs={formRowDelay(1)}>
              <AuthPrimaryButton type="submit" loading={isLoading}>
                {isLoading ? "Sending…" : "Send Reset Link"}
              </AuthPrimaryButton>
            </AuthAnimatedBlock>

            <AuthAnimatedBlock
              delayMs={formRowDelay(2)}
              className="pt-1 text-center text-[15px] font-medium text-slate-500 dark:text-white/60"
            >
              <Link
                href="/login"
                className="text-sm font-semibold text-[#0064E0] transition hover:text-[#0052B8] dark:text-[#5ea1ff]"
              >
                Back to sign in
              </Link>
            </AuthAnimatedBlock>
          </form>
        )}
      </AuthFormCard>
    </AuthAnimatedBlock>
  );

  return (
    <AuthPageShell
      illustrationSrc="/octalve-ims.svg"
      illustrationAlt="Octalve IMS Illustration"
      title="Forgot password?"
      subtitle="Enter your email and we'll send you a link to reset your password."
      left={leftPanel}
      right={rightPanel}
    />
  );
}

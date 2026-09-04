"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { AuthPasswordInput } from "@/components/auth/AuthFieldInput";
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
 * Reset-password consume page. Reads the emailed `?token=` and submits it
 * with a new password to /api/auth/reset-password.
 */
export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "invalid">("idle");
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const formRowDelay = (row: number) =>
    AUTH_FORM_STAGGER_BASE + row * AUTH_FORM_ROW_STAGGER_MS;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        title: "Passwords Don't Match",
        description: "Make sure both password fields are the same.",
        variant: "destructive",
      });
      return;
    }
    if (!token) {
      setStatus("invalid");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 400) {
          setStatus("invalid");
          return;
        }
        throw new Error(data.error || "Something went wrong. Please try again.");
      }
      setStatus("success");
      setTimeout(() => router.push("/login"), 2500);
    } catch (error) {
      toast({
        title: "Reset Failed",
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

  let formBody: React.ReactNode;
  if (status === "success") {
    formBody = (
      <div className="grid gap-5 text-center">
        <AuthAnimatedBlock
          delayMs={formRowDelay(0)}
          className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#EAF3FF] text-[#0064E0] dark:bg-white/10 dark:text-[#5ea1ff]"
        >
          <CheckCircle2 size={28} strokeWidth={2} />
        </AuthAnimatedBlock>
        <AuthAnimatedBlock delayMs={formRowDelay(1)} className="space-y-2">
          <p className="text-[17px] font-semibold text-slate-900 dark:text-white">
            Password updated
          </p>
          <p className="text-[15px] font-medium leading-6 text-slate-500 dark:text-white/60">
            Redirecting you to sign in…
          </p>
        </AuthAnimatedBlock>
      </div>
    );
  } else if (status === "invalid" || !token) {
    formBody = (
      <div className="grid gap-5 text-center">
        <AuthAnimatedBlock
          delayMs={formRowDelay(0)}
          className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400"
        >
          <XCircle size={28} strokeWidth={2} />
        </AuthAnimatedBlock>
        <AuthAnimatedBlock delayMs={formRowDelay(1)} className="space-y-2">
          <p className="text-[17px] font-semibold text-slate-900 dark:text-white">
            Link invalid or expired
          </p>
          <p className="text-[15px] font-medium leading-6 text-slate-500 dark:text-white/60">
            This password reset link is no longer valid. Request a new one to
            continue.
          </p>
        </AuthAnimatedBlock>
        <AuthAnimatedBlock delayMs={formRowDelay(2)} className="pt-2">
          <Link
            href="/forgot-password"
            className="text-sm font-semibold text-[#0064E0] transition hover:text-[#0052B8] dark:text-[#5ea1ff]"
          >
            Request a new link
          </Link>
        </AuthAnimatedBlock>
      </div>
    );
  } else {
    formBody = (
      <form onSubmit={handleSubmit} className="grid gap-5">
        <AuthAnimatedBlock delayMs={formRowDelay(0)}>
          <AuthPasswordInput
            label="New Password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your new password"
            autoComplete="new-password"
            required
            disabled={isLoading}
          />
        </AuthAnimatedBlock>

        <AuthAnimatedBlock delayMs={formRowDelay(1)}>
          <AuthPasswordInput
            label="Confirm Password"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter your new password"
            autoComplete="new-password"
            required
            disabled={isLoading}
          />
        </AuthAnimatedBlock>

        <AuthAnimatedBlock delayMs={formRowDelay(2)}>
          <AuthPrimaryButton type="submit" loading={isLoading}>
            {isLoading ? "Updating…" : "Reset Password"}
          </AuthPrimaryButton>
        </AuthAnimatedBlock>
      </form>
    );
  }

  return (
    <AuthPageShell
      illustrationSrc="/octalve-ims.svg"
      illustrationAlt="Octalve IMS Illustration"
      title="Reset password"
      subtitle="Choose a new password for your account."
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

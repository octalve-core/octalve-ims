"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthFieldInput, AuthPasswordInput } from "@/components/auth/AuthFieldInput";
import {
  AuthDivider,
  AuthGoogleButton,
  AuthPrimaryButton,
} from "@/components/auth/AuthButtons";
import axiosInstance from "@/utils/axiosInstance";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { AuthInfoPanel } from "@/components/auth/AuthInfoPanel";
import { AuthFormCard } from "@/components/auth/AuthFormCard";
import { AuthAnimatedBlock } from "@/components/auth/AuthAnimatedBlock";
import {
  AUTH_FORM_ROW_STAGGER_MS,
  AUTH_FORM_STAGGER_BASE,
} from "@/components/auth/auth-animation";
import { Mail, User } from "lucide-react";

/**
 * Register page — split layout with promo cards + form.
 * REQ-0030 — shared AuthPageShell, stagger animations, max-w-7xl.
 * REQ-0231 — Suite Portal reskin: field/button visuals only, same behavior.
 */
export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleGoogleSignUp = async () => {
    try {
      const oauthUrl = `/api/auth/oauth/google?callback=/`;
      window.location.href = oauthUrl;
    } catch (error) {
      console.error("Error initiating Google OAuth:", error);
      toast({
        title: "OAuth Error",
        description: "Failed to initiate Google sign-in. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (password !== confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Passwords do not match. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      const response = await axiosInstance.post("/auth/register", {
        name,
        email,
        password,
      });

      if (response.status === 201) {
        toast({
          title: "Account Created Successfully! 🎉",
          description: `Welcome, ${name}! Your account has been created. Redirecting to login page...`,
        });

        setName("");
        setEmail("");
        setPassword("");
        setConfirmPassword("");

        setTimeout(() => {
          router.push("/login");
        }, 1500);
      } else {
        throw new Error("Registration failed");
      }
    } catch (error: unknown) {
      const axiosErr = error as {
        response?: { data?: { error?: string }; status?: number };
      };
      const serverMessage = axiosErr?.response?.data?.error;
      toast({
        title: "Registration Failed",
        description:
          serverMessage || "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formRowDelay = (row: number) =>
    AUTH_FORM_STAGGER_BASE + row * AUTH_FORM_ROW_STAGGER_MS;

  const leftPanel = <AuthInfoPanel variant="register" />;

  const rightPanel = (
    <AuthAnimatedBlock delayMs={AUTH_FORM_STAGGER_BASE} className="w-full">
      <AuthFormCard variant="register" className="w-full">
        <form onSubmit={handleSubmit} className="grid gap-5">
          <AuthAnimatedBlock delayMs={formRowDelay(0)}>
            <AuthFieldInput
              label="Name"
              icon={<User size={18} strokeWidth={2} />}
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              autoComplete="name"
              required
              disabled={isLoading}
            />
          </AuthAnimatedBlock>

          <AuthAnimatedBlock delayMs={formRowDelay(1)}>
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

          <AuthAnimatedBlock delayMs={formRowDelay(2)}>
            <AuthPasswordInput
              label="Password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="new-password"
              disabled={isLoading}
            />
          </AuthAnimatedBlock>

          <AuthAnimatedBlock delayMs={formRowDelay(3)}>
            <AuthPasswordInput
              label="Confirm Password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              autoComplete="new-password"
              disabled={isLoading}
            />
          </AuthAnimatedBlock>

          <AuthAnimatedBlock delayMs={formRowDelay(4)}>
            <AuthPrimaryButton type="submit" loading={isLoading}>
              {isLoading ? "Creating Account…" : "Sign Up"}
            </AuthPrimaryButton>
          </AuthAnimatedBlock>

          <AuthAnimatedBlock delayMs={formRowDelay(5)}>
            <AuthDivider label="or" />
          </AuthAnimatedBlock>

          <AuthAnimatedBlock delayMs={formRowDelay(6)}>
            <AuthGoogleButton
              variant="register"
              loading={isLoading}
              onClick={handleGoogleSignUp}
            >
              Continue with Google
            </AuthGoogleButton>
          </AuthAnimatedBlock>

          <AuthAnimatedBlock
            delayMs={formRowDelay(7)}
            className="pt-1 text-center text-[15px] font-medium text-slate-500 dark:text-white/60"
          >
            Already have an account?{" "}
            <Link
              href="/login"
              className="inline-flex rounded-full bg-[#EAF3FF] px-3 py-1 font-semibold text-[#0064E0] ring-1 ring-[#0064E0]/10 transition hover:bg-[#0064E0] hover:text-white dark:bg-white/10 dark:text-[#5ea1ff] dark:ring-white/10 dark:hover:bg-[#0064E0] dark:hover:text-white"
            >
              Sign in
            </Link>
          </AuthAnimatedBlock>
        </form>
      </AuthFormCard>
    </AuthAnimatedBlock>
  );

  return (
    <AuthPageShell
      illustrationSrc="/octalve-ims.svg"
      illustrationAlt="Octalve IMS Illustration"
      title="Create account"
      subtitle="Sign up to get started with your inventory dashboard."
      left={leftPanel}
      right={rightPanel}
    />
  );
}

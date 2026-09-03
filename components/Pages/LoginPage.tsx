"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthFieldInput, AuthPasswordInput } from "@/components/auth/AuthFieldInput";
import {
  AuthDivider,
  AuthGoogleButton,
  AuthPrimaryButton,
} from "@/components/auth/AuthButtons";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { setPostLoginWelcome } from "@/lib/auth/post-login-welcome";
import { testAccounts } from "@/lib/auth/test-accounts";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { AuthInfoPanel } from "@/components/auth/AuthInfoPanel";
import { AuthFormCard } from "@/components/auth/AuthFormCard";
import { AuthAnimatedBlock } from "@/components/auth/AuthAnimatedBlock";
import { LoginRoleSelect } from "@/components/auth/LoginRoleSelect";
import {
  AUTH_FORM_ROW_STAGGER_MS,
  AUTH_FORM_STAGGER_BASE,
} from "@/components/auth/auth-animation";
import { Mail } from "lucide-react";

/**
 * Login page client component (uses useSearchParams for OAuth/redirect).
 * REQ-0030 — shared AuthPageShell, role Select icons, stagger animations.
 * REQ-0231 — Suite Portal reskin: field/button visuals only, same behavior.
 */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isNavigatingToHome, setIsNavigatingToHome] = useState(false);
  const { login, isLoggedIn, user } = useAuth();

  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const navigatingFromSubmitRef = useRef(false);

  useEffect(() => {
    if (isLoggedIn && !navigatingFromSubmitRef.current) {
      const dest =
        user?.role === "client"
          ? "/client"
          : user?.role === "supplier"
            ? "/supplier"
            : "/";
      window.location.href = dest;
    }
  }, [isLoggedIn, user]);

  useEffect(() => {
    const error = searchParams.get("error");
    if (error) {
      let errorMessage = "An error occurred during Google sign-in.";

      switch (error) {
        case "oauth_not_configured":
          errorMessage =
            "Google OAuth is not configured. Please contact support.";
          break;
        case "oauth_failed":
          errorMessage =
            "Google sign-in was cancelled or failed. Please try again.";
          break;
        case "invalid_state":
          errorMessage = "Invalid OAuth state. Please try again.";
          break;
        case "no_code":
          errorMessage = "OAuth authorization code missing. Please try again.";
          break;
        case "token_exchange_failed":
          errorMessage = "Failed to exchange OAuth token. Please try again.";
          break;
        case "fetch_user_failed":
          errorMessage =
            "Failed to fetch user information from Google. Please try again.";
          break;
        case "no_email":
          errorMessage = "Google account email is required. Please try again.";
          break;
        case "oauth_processing_failed":
        case "oauth_error":
          errorMessage =
            "An error occurred during OAuth processing. Please try again.";
          break;
        default:
          errorMessage = `OAuth error: ${error}. Please try again.`;
      }

      toast({
        title: "Google Sign-In Failed",
        description: errorMessage,
        variant: "destructive",
      });

      router.replace("/login");
    }
  }, [searchParams, router, toast]);

  const handleRoleSelect = (value: string) => {
    if (value === "clear") {
      setSelectedRole("");
      setEmail("");
      setPassword("");
    } else {
      setSelectedRole(value);
      const account = testAccounts[value as keyof typeof testAccounts];
      if (account) {
        setEmail(account.email);
        setPassword(account.password);
      }
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const redirectUrl = searchParams.get("redirect") || "/";
      const oauthUrl = `/api/auth/oauth/google?callback=${encodeURIComponent(
        redirectUrl,
      )}`;
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

    try {
      const userData = await login(email, password, rememberMe);
      const userName = userData.name || userData.email.split("@")[0] || "User";

      navigatingFromSubmitRef.current = true;
      setIsNavigatingToHome(true);

      setPostLoginWelcome({
        userName,
        role: userData.role ?? "user",
      });

      const dest =
        userData.role === "client"
          ? "/client"
          : userData.role === "supplier"
            ? "/supplier"
            : "/";
      window.location.href = dest;
    } catch (error: unknown) {
      const axiosErr = error as {
        response?: { data?: { error?: string }; status?: number };
      };
      const serverMessage = axiosErr?.response?.data?.error;
      toast({
        title: "Login Failed",
        description:
          serverMessage || "Invalid email or password. Please try again.",
        variant: "destructive",
      });
    } finally {
      if (!navigatingFromSubmitRef.current) setIsLoading(false);
    }
  };

  const formDisabled = isLoading || isNavigatingToHome;

  const formRowDelay = (row: number) =>
    AUTH_FORM_STAGGER_BASE + row * AUTH_FORM_ROW_STAGGER_MS;

  const leftPanel = <AuthInfoPanel variant="login" />;

  const rightPanel = (
    <AuthAnimatedBlock delayMs={AUTH_FORM_STAGGER_BASE} className="w-full">
      <AuthFormCard variant="login" className="w-full">
        <form onSubmit={handleSubmit} className="grid gap-5">
          <AuthAnimatedBlock delayMs={formRowDelay(0)} className="space-y-2">
            <span className="mb-2 block text-[13px] font-semibold text-slate-700 dark:text-white/80">
              Test Accounts To Login With
            </span>
            <LoginRoleSelect
              selectedRole={selectedRole}
              onRoleSelect={handleRoleSelect}
              disabled={formDisabled}
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
              disabled={formDisabled}
            />
          </AuthAnimatedBlock>

          <AuthAnimatedBlock delayMs={formRowDelay(2)}>
            <AuthPasswordInput
              label="Password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
              disabled={formDisabled}
            />
          </AuthAnimatedBlock>

          <AuthAnimatedBlock
            delayMs={formRowDelay(3)}
            className="flex items-center justify-between gap-4"
          >
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-600 dark:text-white/70">
              <Checkbox
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
                disabled={formDisabled}
              />
              Keep me signed in
            </label>
            <Link
              href="/register"
              className="text-sm font-semibold text-[#0064E0] transition hover:text-[#0052B8] dark:text-[#5ea1ff]"
            >
              Need an account?
            </Link>
          </AuthAnimatedBlock>

          <AuthAnimatedBlock delayMs={formRowDelay(4)}>
            <AuthPrimaryButton type="submit" loading={formDisabled}>
              {isNavigatingToHome
                ? "Loading Dashboard…"
                : isLoading
                  ? "Signing In…"
                  : "Sign In"}
            </AuthPrimaryButton>
          </AuthAnimatedBlock>

          <AuthAnimatedBlock delayMs={formRowDelay(5)}>
            <AuthDivider label="or" />
          </AuthAnimatedBlock>

          <AuthAnimatedBlock delayMs={formRowDelay(6)}>
            <AuthGoogleButton
              variant="login"
              loading={formDisabled}
              onClick={handleGoogleSignIn}
            >
              Continue with Google
            </AuthGoogleButton>
          </AuthAnimatedBlock>

          <AuthAnimatedBlock
            delayMs={formRowDelay(7)}
            className="pt-1 text-center text-[15px] font-medium text-slate-500 dark:text-white/60"
          >
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="inline-flex rounded-full bg-[#EAF3FF] px-3 py-1 font-semibold text-[#0064E0] ring-1 ring-[#0064E0]/10 transition hover:bg-[#0064E0] hover:text-white dark:bg-white/10 dark:text-[#5ea1ff] dark:ring-white/10 dark:hover:bg-[#0064E0] dark:hover:text-white"
            >
              Create account
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
      title="Sign in"
      subtitle="Sign in to your account to continue to your workspace."
      left={leftPanel}
      right={rightPanel}
    />
  );
}

"use client";

import { useState } from "react";
import { KeyRound, Eye, EyeOff } from "lucide-react";
import AppShell from "@/components/layouts/AppShell";
import {
  PageContentWrapper,
  PageSectionHeader,
  SectionCardHeader,
  GlassCard,
  GlassCardBody,
  GLASS_BUTTON_ICON_HOVER,
  GLASS_PRIMARY_BUTTON,
} from "@/components/shared";
import { cn } from "@/lib/utils";
import { DETAIL_PAGE_HEADER_SPACING_CLASS } from "@/lib/ui/shell-layout-styles";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useChangePassword } from "@/hooks/queries/use-change-password";

export type ChangePasswordPageProps = {
  /** When true, render only content (no AppShell) for use inside admin layout */
  embedded?: boolean;
};

/** Change-password settings screen (ISS-0084) — calls the existing /api/auth/change-password route. */
export default function ChangePasswordPage({ embedded }: ChangePasswordPageProps = {}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const { toast } = useToast();
  const changePassword = useChangePassword();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      toast({
        title: "Password too short",
        description: "Your new password must be at least 8 characters.",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Make sure both new-password fields are the same.",
        variant: "destructive",
      });
      return;
    }

    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        },
      },
    );
  };

  const content = (
    <PageContentWrapper>
      <div className="flex flex-col gap-6">
        <PageSectionHeader
          as="h1"
          icon={KeyRound}
          tone="sky"
          title="Change Password"
          description="Update the password you use to sign in. You'll need to log in again on every device afterward."
          className={DETAIL_PAGE_HEADER_SPACING_CLASS}
        />

        <GlassCard variant="sky">
          <GlassCardBody>
            <SectionCardHeader
              icon={KeyRound}
              tone="sky"
              title="Update your password"
              className="mb-4"
            />
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current password</Label>
                <Input
                  id="currentPassword"
                  type={showPasswords ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={changePassword.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New password</Label>
                <Input
                  id="newPassword"
                  type={showPasswords ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  disabled={changePassword.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm new password</Label>
                <Input
                  id="confirmPassword"
                  type={showPasswords ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  disabled={changePassword.isPending}
                />
              </div>

              <button
                type="button"
                onClick={() => setShowPasswords((v) => !v)}
                className="flex items-center gap-1.5 self-start text-xs text-muted-foreground hover:text-foreground"
              >
                {showPasswords ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
                {showPasswords ? "Hide" : "Show"} passwords
              </button>

              <Button
                type="submit"
                disabled={changePassword.isPending}
                className={cn(GLASS_BUTTON_ICON_HOVER, "gap-2 self-start", GLASS_PRIMARY_BUTTON.sky)}
              >
                {changePassword.isPending ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </GlassCardBody>
        </GlassCard>
      </div>
    </PageContentWrapper>
  );

  if (embedded) return content;
  return <AppShell>{content}</AppShell>;
}

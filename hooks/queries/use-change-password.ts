/**
 * Change-password mutation hook (ISS-0084) — the API route has existed
 * since task 0004 but nothing in the UI ever called it. A success revokes
 * every session (including this device's), so this also signs the user out
 * and sends them to /login once the toast is visible.
 */
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiClient, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/contexts";
import { useToast } from "@/hooks/use-toast";

export function useChangePassword() {
  const { logout } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  return useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const response = await apiClient.auth.changePassword(data);
      return response.data;
    },
    onSuccess: async () => {
      toast({
        title: "Password updated",
        description: "You've been signed out everywhere for security. Please log in again.",
      });
      await logout().catch(() => {});
      router.push("/login");
    },
    onError: (error: unknown) => {
      toast({
        title: "Couldn't update password",
        description: getErrorMessage(error) || "Please try again.",
        variant: "destructive",
      });
    },
  });
}

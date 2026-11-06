"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * App Router's root error boundary (ISS-0075) — without this file, an
 * uncaught render error anywhere under app/ fell through to Next's bare
 * default error screen instead of anything matching this app's UI. Must be
 * a client component — Next requires it.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console -- no server-side logging hook reaches this boundary
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-medium text-muted-foreground">Error</p>
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        An unexpected error occurred. You can try again, or head back to the dashboard.
      </p>
      <Button onClick={() => reset()} className="mt-2">
        Try again
      </Button>
    </div>
  );
}

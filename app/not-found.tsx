import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * App Router's actual not-found boundary (ISS-0075) — this file's exact
 * path is what Next looks for; the old `app/_not-found/page.tsx` was just
 * an ordinary route at the literal path "/_not-found" that nothing ever
 * linked to, so every real 404 fell through to Next's unstyled default.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or may have been moved.
      </p>
      <Button asChild className="mt-2">
        <Link href="/">Back to dashboard</Link>
      </Button>
    </div>
  );
}

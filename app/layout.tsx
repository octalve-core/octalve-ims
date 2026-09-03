/**
 * Root layout: fonts, metadata (SEO), and providers (Query, Auth, Theme, Toaster).
 * Wraps all pages; force-dynamic so useSearchParams and server session work correctly.
 */
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { KeyboardShortcutsProvider } from "@/components/providers/KeyboardShortcutsProvider";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import React from "react";
import { AuthProvider } from "@/contexts";
import { ShellSsrProvider } from "@/contexts/shell-ssr-context";
import { getSession } from "@/lib/auth-server";
import { mapSessionToAppUser } from "@/lib/auth/map-session-user";
import { getShellNotificationsForUser } from "@/lib/server/notifications-data";
import { getThemePrimaryColor } from "@/lib/server/system-config-data";
import { QueryProvider } from "@/lib/react-query";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { AuthSessionToasts } from "@/components/shared/AuthSessionToasts";
import { SuppressApiErrorOverlay } from "@/components/shared/SuppressApiErrorOverlay";
import { RouteWarmPrefetch } from "@/components/providers/RouteWarmPrefetch";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

/**
 * REQ-0231 — Suite Portal reskin: swap the app's global sans font from
 * Poppins (geometric/rounded) to Inter, matching octalve-suite-portal's
 * font-family stack (Inter → system-ui). Kept as the `--font-poppins`
 * CSS variable / `.poppins` class name (see globals.css) so the ~60
 * components applying that class app-wide don't need touching — only
 * what the variable resolves to changes.
 */
const poppins = Inter({
  subsets: ["latin"],
  variable: "--font-poppins",
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

/** Force dynamic rendering for all routes so useSearchParams etc. work without Suspense and pages render instantly. */
export const dynamic = "force-dynamic";

export const metadata = {
  title: {
    default: "Octalve IMS — Inventory & Warehouse Management System",
    template: "%s | Octalve IMS — Inventory & Warehouse Management System",
  },
  description:
    "Octalve IMS is a full-stack inventory and warehouse management system built with Next.js. Manage products, categories, suppliers, orders, invoices, and warehouses. Role-based access for admin, client, and supplier. Analytics dashboard, QR codes, export, and secure JWT authentication.",
  creator: "Octalve",
  publisher: "Octalve",
  applicationName: "Octalve IMS",
  keywords: [
    "inventory management",
    "warehouse management",
    "stock management system",
    "Next.js",
    "React",
    "Prisma",
    "product catalog",
    "orders",
    "invoices",
    "suppliers",
    "categories",
    "JWT authentication",
    "responsive web app",
    "business dashboard",
    "Octalve",
  ],
  icons: {
    icon: "/favicon.ico",
    apple: "/favicon.ico",
    other: [{ rel: "icon", url: "/favicon.ico" }],
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://octalve-ims.vercel.app",
  ),
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "Octalve IMS — Inventory & Warehouse Management System",
    description:
      "Efficiently manage products, orders, invoices, and warehouses with Octalve IMS. Secure, responsive, role-based inventory system.",
    url: "https://octalve-ims.vercel.app",
    siteName: "Octalve IMS",
    images: [
      {
        url: "/favicon.ico",
        width: 32,
        height: 32,
        alt: "Octalve IMS — Inventory Management",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Octalve IMS — Inventory & Warehouse Management System",
    description:
      "Efficiently manage products, orders, invoices, and warehouses. Secure, responsive inventory system.",
    images: ["/favicon.ico"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

/** Optional: set NEXT_PUBLIC_DISABLE_BROWSER_TRANSLATE=true on Vercel prod only (blocks Chrome Translate). */
const disableBrowserTranslate =
  process.env.NEXT_PUBLIC_DISABLE_BROWSER_TRANSLATE === "true";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  const initialUser = session ? mapSessionToAppUser(session) : null;
  const shellNotifications = session
    ? await getShellNotificationsForUser(session.id)
    : null;
  const themePrimaryColor = await getThemePrimaryColor();

  return (
    <html
      lang="en"
      {...(disableBrowserTranslate ? { translate: "no" as const } : {})}
      suppressHydrationWarning
      style={
        {
          overscrollBehavior: "none",
          // Overrides --primary/--ring from globals.css (admin-editable, see
          // Appearance settings + lib/server/system-config-data.ts) — both
          // tokens share the brand hue there in light and dark, so they're
          // kept in sync here too (focus rings would otherwise stay the
          // default red after changing the brand color). Set on <html>
          // rather than body so it's visible to the whole subtree, including
          // anything portalled to document.body (dialogs, toasts).
          "--primary": themePrimaryColor,
          "--ring": themePrimaryColor,
        } as React.CSSProperties
      }
      data-scroll-behavior="smooth"
    >
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${poppins.variable} antialiased`}
        suppressHydrationWarning
        style={{ overscrollBehavior: "none" }}
      >
        <ErrorBoundary>
          <QueryProvider>
            <AuthProvider initialUser={initialUser}>
              <ShellSsrProvider
                value={
                  shellNotifications ?? {
                    initialNotifications: undefined,
                    initialUnreadCount: undefined,
                  }
                }
              >
              <RouteWarmPrefetch />
              <SuppressApiErrorOverlay />
              <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
              >
                <TooltipProvider delayDuration={200}>
                  <KeyboardShortcutsProvider>
                    {children}
                  </KeyboardShortcutsProvider>
                </TooltipProvider>
              </ThemeProvider>
              {/* Toaster must mount before AuthSessionToasts so useToast listeners exist when deferred toasts fire */}
              <Toaster />
              <AuthSessionToasts />
              </ShellSsrProvider>
            </AuthProvider>
          </QueryProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}

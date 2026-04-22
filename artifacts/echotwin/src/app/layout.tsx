import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/context/language-context";
import { PwaLifecycle } from "@/components/app/pwa-lifecycle";
import "./globals.css";

const appName = "BendekiSen";
const appDescription =
  "Geçmiş sohbetlerinden kişisel ve duygusal bir yapay zeka sohbet deneyimi oluştur.";

export const metadata: Metadata = {
  applicationName: appName,
  title: {
    default: `${appName} - Sanki hâlâ karşındaymış gibi`,
    template: `%s | ${appName}`,
  },
  description: appDescription,
  manifest: "/manifest.json",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://bendekisen.app"),
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/favicon.svg",
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: appName,
    startupImage: [
      {
        url: "/icons/apple-touch-icon.png",
        media:
          "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)",
      },
    ],
  },
  openGraph: {
    title: appName,
    description: appDescription,
    siteName: appName,
    images: [{ url: "/icons/icon-512.png", width: 512, height: 512, alt: appName }],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: appName,
    description: appDescription,
    images: ["/icons/icon-512.png"],
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#071421" },
    { media: "(prefers-color-scheme: dark)", color: "#071421" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" suppressHydrationWarning className="dark">
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          disableTransitionOnChange
        >
          <LanguageProvider>
            <PwaLifecycle />
            {children}
            <Toaster richColors position="top-center" />
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

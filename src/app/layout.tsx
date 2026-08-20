import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { Inter, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/components/auth/auth-provider";
import { TenantProvider } from "@/components/tenant/tenant-provider";
import { GoogleMapsProvider } from "@/components/google-maps-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = "https://mstechind.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "MST-VTS — Fleet Management Dashboard",
    template: "%s | MST-VTS",
  },
  description:
    "MST-VTS is a modern fleet management platform with real-time GPS tracking, vehicle monitoring, driver management, geofencing, and comprehensive reporting.",
  keywords: [
    "fleet management",
    "GPS tracking",
    "vehicle tracking",
    "fleet telematics",
    "driver management",
    "geofencing",
    "route optimization",
    "GPS devices",
    "fleet dashboard",
  ],
  authors: [{ name: "MST-VTS" }],
  creator: "MST-VTS",
  publisher: "MST-VTS",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "MST-VTS",
    title: "MST-VTS — Fleet Management Dashboard",
    description:
      "Modern fleet management platform with real-time GPS tracking, vehicle monitoring, driver management, and comprehensive reporting.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "MST-VTS Fleet Management Dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MST-VTS — Fleet Management Dashboard",
    description:
      "Modern fleet management platform with real-time GPS tracking, vehicle monitoring, and comprehensive reporting.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col bg-background text-foreground">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "MST-VTS",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              url: SITE_URL,
              description:
                "Modern fleet management platform with real-time GPS tracking, vehicle monitoring, driver management, and comprehensive reporting.",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
              provider: {
                "@type": "Organization",
                name: "MST-VTS",
                url: SITE_URL,
              },
            }),
          }}
        />
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TenantProvider>
            <AuthProvider>
              <GoogleMapsProvider>
                {children}
              </GoogleMapsProvider>
              <Toaster richColors position="top-right" />
            </AuthProvider>
          </TenantProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

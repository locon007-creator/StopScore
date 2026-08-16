import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./v2/styles.css";
import { ThemeProvider } from "./theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StopScore Driver OS",
  description: "A calm daily operating system for truck drivers.",
  manifest: "/manifest.webmanifest",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeBootScript = `(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("stopscore-driver-preferences") || "{}");
      const preference = ["auto", "light", "dark"].includes(stored.themeMode) ? stored.themeMode : "dark";
      const systemDark = typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
      const mode = preference === "auto" ? (systemDark ? "dark" : "light") : preference;
      document.documentElement.dataset.themePreference = preference;
      document.documentElement.dataset.theme = mode;
      document.documentElement.style.colorScheme = mode;
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", mode === "dark" ? "#050505" : "#ffffff");
    } catch {
      document.documentElement.dataset.themePreference = "dark";
      document.documentElement.dataset.theme = "dark";
      document.documentElement.style.colorScheme = "dark";
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#050505");
    }
  })();`;

  return (
    <html lang="en" data-theme="dark" data-theme-preference="dark" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#050505" />
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

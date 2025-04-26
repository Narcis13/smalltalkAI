/**
 * <ai_info>
 * This file defines the root layout for the Next.js application.
 * It sets up the HTML structure, includes global styles and fonts, and applies the
 * Geist font variables. It now also wraps the application content (`children`)
 * with the `SonEnvironmentProvider` to make the SON execution environment context
 * available throughout the application.
 * </ai_info>
 *
 * @file client/src/app/layout.tsx
 * @description Root layout component for the Next.js application, including the SON environment provider.
 *
 * @dependencies
 * - next/font/google: For loading Geist Sans and Mono fonts.
 * - ./globals.css: Global application styles (including Tailwind directives).
 * - ../contexts/SonEnvironmentContext: The provider component for the SON environment.
 *
 * @notes
 * - All pages/components within this layout will have access to the `useSonEnvironment` hook.
 * - The layout itself is marked "use client" because the Provider uses client-side hooks (`useState`, `useEffect`).
 */
"use client"; // Provider uses client hooks, so layout must be client component

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SonEnvironmentProvider } from "@/contexts/SonEnvironmentContext"; // Import the provider

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});


/**
 * Root layout component for the SON Environment application.
 * Sets up HTML structure, fonts, global styles, and wraps children
 * with the SonEnvironmentProvider.
 *
 * @param {Readonly<{ children: React.ReactNode }>} props - Component props containing child elements.
 * @returns {JSX.Element} The root layout structure.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactNode { // Return type explicitly set to React.ReactNode for clarity
  return (
    <html lang="en">
      <body
        // Apply font variables and base Tailwind antialiasing
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        {/* Wrap the entire application content with the environment provider */}
        <SonEnvironmentProvider>
          {/* Main content area, allow it to grow */}
          <main className="flex-grow flex flex-col">
            {children}
          </main>
        </SonEnvironmentProvider>
      </body>
    </html>
  );
}

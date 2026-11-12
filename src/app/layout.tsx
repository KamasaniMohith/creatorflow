import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppProvider } from "@/components/SupabaseAppProvider";
import { AuthProvider } from "@/components/AuthProvider";
import { WorkspaceProvider } from "@/components/WorkspaceProvider";
import { AppLayout } from "@/components/layout/AppLayout";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CreatorFlow | Influencer discovery & outreach",
  description: "Discover creators, organize campaigns, and manage outreach.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AuthProvider>
          <WorkspaceProvider>
            <AppProvider>
              <AppLayout>{children}</AppLayout>
            </AppProvider>
          </WorkspaceProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles/index.css";
import "@/styles/globals.css";
import "@/styles/cursor-overrides.css";
import { AuthProvider } from "@/app/context/auth-context";
import { CaptureRecoveryGate } from "@/features/capture/components/capture-recovery-gate";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Capstone",
  description: "Business Intelligence Tool",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={inter.className}
      >
        <AuthProvider>
          <CaptureRecoveryGate />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

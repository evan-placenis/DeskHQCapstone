import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../frontend/src/index.css";
import "../frontend/src/styles/globals.css";
import "../frontend/src/styles/cursor-overrides.css";
import { AuthProvider } from "@/src/app/context/AuthContext";

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
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

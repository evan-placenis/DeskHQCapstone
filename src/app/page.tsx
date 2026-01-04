"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/app/pages/config/routes";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.push(ROUTES.login);
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-slate-500">Loading...</div>
    </main>
  );
}

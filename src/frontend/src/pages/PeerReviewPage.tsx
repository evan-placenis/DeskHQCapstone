"use client";

import { ReviewerForecastPage } from "@/frontend/pages/ReviewerForecastPage";
import { useRouter } from "next/navigation";
import { Page } from "@/app/pages/config/routes";
import { ROUTES, getRoute } from "@/app/pages/config/routes";
import { useAuth } from "@/src/app/context/AuthContext";

export function PeerReviewPage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const currentUser = user
    ? {
        id: typeof user.id === "number" ? user.id : Number(user.id) || 0,
        name: user.name ?? user.email ?? "User",
        role: "manager" as const,
        team: user.team ?? "Team A",
      }
    : {
        id: 2,
        name: "Sarah Johnson",
        role: "manager" as const,
        team: "Team A",
      };

  const handleNavigate = (page: Page) => {
    router.push(getRoute(page));
  };

  const handleLogout = () => {
    logout();
  };

  const handleRoleSwitch = (role: "manager" | "technician") => {
    if (role === "technician") {
      router.push(ROUTES.mystats);
    }
  };

  if (!user) return null;

  return (
    <ReviewerForecastPage
      currentUser={currentUser}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      onRoleSwitch={handleRoleSwitch}
    />
  );
}

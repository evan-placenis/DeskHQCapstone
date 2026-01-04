"use client";
import { ReviewerForecastPage } from "@/frontend/pages/ReviewerForecastPage";
import { useRouter } from "next/navigation";
import { Page } from "@/app/pages/config/routes";
import { ROUTES, getRoute } from "@/app/pages/config/routes";

export default function Reviewer() {
  const router = useRouter();

  // Mock user for reviewer view
  const currentUser = {
    id: 2,
    name: "Sarah Johnson",
    role: "manager" as const,
    team: "Team A"
  };

  const handleNavigate = (page: Page) => {
    router.push(getRoute(page));
  };

  const handleLogout = () => {
    router.push(ROUTES.login);
  };

  const handleRoleSwitch = (role: "manager" | "technician") => {
    console.log("Switching role:", role);
    if (role === "technician") {
      router.push(ROUTES.mystats);
    }
  };

  return (
    <ReviewerForecastPage
      currentUser={currentUser}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      onRoleSwitch={handleRoleSwitch}
    />
  );
}


"use client";
import { TechnicianAnalyticsPage } from "@/frontend/pages/TechnicianAnalyticsPage";
import { useRouter } from "next/navigation";
import { Page } from "@/app/pages/config/routes";
import { ROUTES, getRoute } from "@/app/pages/config/routes";

export default function MyStats() {
  const router = useRouter();
  
  // Mock user for technician view
  const currentUser = {
    id: 3,
    name: "Mike Technician",
    role: "technician" as const,
    team: "Team A"
  };

  const handleNavigate = (page: Page) => {
    router.push(getRoute(page));
  };

  const handleLogout = () => {
    router.push(ROUTES.login);
  };

  const handleRoleSwitch = (role: "manager" | "technician") => {
    console.log("Switching to role:", role);
    if (role === "manager") {
      router.push(ROUTES.analytics);
    }
  };

  return (
    <TechnicianAnalyticsPage
      currentUser={currentUser}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      onRoleSwitch={handleRoleSwitch}
    />
  );
}


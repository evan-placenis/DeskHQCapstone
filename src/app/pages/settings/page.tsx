"use client";
import { SettingsPage } from "@/frontend/pages/SettingsPage";
import { useRouter } from "next/navigation";
import { Page } from "@/app/pages/config/routes";
import { ROUTES, getRoute } from "@/app/pages/config/routes";

export default function Settings() {
  const router = useRouter();

  // Mock user
  const currentUser = {
    id: 1,
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

  // Note: SettingsPage component definition seems to be missing onRoleSwitch prop in interface
  // but it is passed here. If SettingsPage ignores it, that's fine, but it might be used in AppHeader.
  // We can pass it anyway if we update the interface in SettingsPage.
  // For now I'll implement it here but maybe not pass it if it causes type error, 
  // or I should fix SettingsPage interface too.
  
  return (
    <SettingsPage
      currentUser={currentUser}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
    />
  );
}


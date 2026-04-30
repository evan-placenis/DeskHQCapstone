"use client";

import { Home, BarChart3, ClipboardCheck, Activity, Camera, type LucideIcon } from "lucide-react";
import { Page } from "@/app/pages/config/routes";
import { cn } from "@/components/ui/utils";

interface MobileBottomNavProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onRecordClick?: () => void;
  currentUser?: { role: "manager" | "technician"; name: string; email: string };
}

type NavItem = {
  id: Page | "capture";
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  /** Larger Home icon for technicians (no Analytics column). */
  isExtraLarge?: boolean;
};

export function MobileBottomNav({ currentPage, onNavigate, onRecordClick, currentUser }: MobileBottomNavProps) {
  const isManager = currentUser?.role === "manager";

  const navItems: NavItem[] = [
    {
      id: "dashboard",
      icon: Home,
      label: "Home",
      onClick: () => onNavigate("dashboard"),
      isExtraLarge: !isManager,
    },
    ...(isManager
      ? [
          {
            id: "analytics" as Page,
            icon: BarChart3,
            label: "Analytics",
            onClick: () => onNavigate("analytics"),
          } satisfies NavItem,
        ]
      : []),
    {
      id: "capture",
      icon: Camera,
      label: "Capture",
      onClick: onRecordClick || (() => alert("Capture feature coming soon!")),
    },
    {
      id: "mystats",
      icon: Activity,
      label: "My Stats",
      onClick: () => onNavigate("mystats"),
    },
    {
      id: "reviewer",
      icon: ClipboardCheck,
      label: "Reviewer",
      onClick: () => onNavigate("reviewer"),
    },
  ];

  const isActive = (itemId: string) => {
    if (itemId === "dashboard") {
      return (
        currentPage === "dashboard" ||
        currentPage === "project" ||
        currentPage === "report" ||
        currentPage === "audio-timeline"
      );
    }
    if (itemId === "capture") {
      return currentPage === "capture-session";
    }
    return currentPage === itemId;
  };

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 safe-area-bottom">
      <div className={`grid ${isManager ? "grid-cols-5" : "grid-cols-4"} items-end px-2 py-2`}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.id);
          const iconLg = item.isExtraLarge && !active;

          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className={cn(
                "flex flex-col items-center justify-center py-1.5 min-w-0 transition-colors",
                item.id === "capture" && !isManager && "col-start-2"
              )}
            >
              {/* Gray circle only for the active route — inactive tabs are icon-only like Home in the mock */}
              <div
                className={cn(
                  "flex items-center justify-center rounded-full transition-all active:scale-95",
                  active ? "h-12 w-12 bg-slate-200 shadow-sm" : "h-10 w-10"
                )}
              >
                <Icon
                  className={cn(
                    iconLg ? "w-7 h-7" : "w-6 h-6",
                    active ? "text-slate-800" : "text-slate-500"
                  )}
                />
              </div>
              <span
                className={cn(
                  "mt-0.5 text-[10px] text-center leading-tight max-w-full truncate px-0.5",
                  active ? "font-semibold text-slate-900" : "text-slate-600"
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

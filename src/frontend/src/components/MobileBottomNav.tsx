import { Home, Mic, BarChart3, ClipboardCheck, Activity, Camera } from "lucide-react";
import { Page } from "../App";

interface MobileBottomNavProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onRecordClick?: () => void;
  currentUser?: { role: "manager" | "technician"; name: string; email: string };
}

export function MobileBottomNav({ currentPage, onNavigate, onRecordClick, currentUser }: MobileBottomNavProps) {
  const isManager = currentUser?.role === "manager";
  
  // Build nav items based on user role
  const navItems = [
    {
      id: "dashboard" as Page,
      icon: Home,
      label: "Home",
      onClick: () => onNavigate("dashboard"),
      // Home is extra big for technicians (when analytics is hidden)
      isExtraLarge: !isManager,
    },
    // Analytics - Only visible for managers
    ...(isManager ? [{
      id: "analytics" as Page,
      icon: BarChart3,
      label: "Analytics",
      onClick: () => onNavigate("analytics"),
    }] : []),
    {
      id: "capture",
      icon: Camera,
      label: "Capture",
      onClick: onRecordClick || (() => alert("Capture feature coming soon!")),
      isSpecial: true,
    },
    {
      id: "mystats" as Page,
      icon: Activity,
      label: "My Stats",
      onClick: () => onNavigate("mystats"),
    },
    {
      id: "reviewer" as Page,
      icon: ClipboardCheck,
      label: "Reviewer",
      onClick: () => onNavigate("reviewer"),
    },
  ];

  const isActive = (itemId: string) => {
    if (itemId === "dashboard") {
      return currentPage === "dashboard" || currentPage === "project" || currentPage === "report" || currentPage === "audio-timeline";
    }
    return currentPage === itemId;
  };

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 safe-area-bottom">
      <div className={`grid ${isManager ? 'grid-cols-5' : 'grid-cols-4'} items-center px-2 py-2`}>
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const active = isActive(item.id);

          if (item.isSpecial) {
            // Special Record button - centered properly
            return (
              <button
                key={item.id}
                onClick={item.onClick}
                className={`flex flex-col items-center justify-center relative -mt-2 ${
                  !isManager ? 'col-start-2' : ''
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-theme-action-primary hover:bg-theme-action-primary-hover shadow-lg flex items-center justify-center transition-all active:scale-95">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-[10px] text-slate-600 mt-0.5">{item.label}</span>
              </button>
            );
          }

          // Regular navigation buttons - with extra large option for technician's home button
          return (
            <button
              key={item.id}
              onClick={item.onClick}
              className={`flex flex-col items-center justify-center py-2 transition-colors ${
                active ? "text-theme-action-primary" : "text-slate-500"
              }`}
            >
              <Icon className={`${item.isExtraLarge ? "w-7 h-7" : "w-6 h-6"} ${active ? "text-theme-action-primary" : "text-slate-500"}`} />
              <span className={`text-[10px] mt-1 ${active ? "text-theme-action-primary font-medium" : "text-slate-600"}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
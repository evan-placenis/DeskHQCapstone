"use client";

import { Button } from "@/frontend/pages/ui_components/button";
import { Avatar, AvatarFallback } from "@/frontend/pages/ui_components/avatar";
import { Badge } from "@/frontend/pages/ui_components/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/frontend/pages/ui_components/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/frontend/pages/ui_components/sheet";
import { Page } from "@/app/pages/config/routes";
import { User } from "@/frontend/types";
import { Cpu, Settings, LogOut, BarChart3, Home, Shield, UserCog, Wrench, Menu, Activity } from "lucide-react";
import { useState } from "react";

interface AppHeaderProps {
  currentPage: Page;
  currentUser?: User;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  onRoleSwitch?: (role: "manager" | "technician") => void;
  pageTitle?: string; // Optional page title to display in header
}

export function AppHeader({ currentPage, currentUser, onNavigate, onLogout, onRoleSwitch, pageTitle }: AppHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "manager":
        return (
          <Badge className="bg-theme-primary hover:bg-theme-primary-hover rounded-md text-white">
            <Shield className="w-3 h-3 mr-1" />
            Manager
          </Badge>
        );
      case "technician":
        return (
          <Badge variant="secondary" className="rounded-md">
            <Wrench className="w-3 h-3 mr-1" />
            Technician
          </Badge>
        );
      default:
        return null;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase();
  };

  const handleNavigation = (page: Page) => {
    onNavigate(page);
    setMobileMenuOpen(false);
  };

  return (
    <header className="bg-card border-b border-border shadow-sm transition-colors sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between max-w-7xl">
        {/* Logo */}
        <div className="flex items-center gap-3 sm:gap-6">
          <div className="flex items-center gap-2 sm:gap-3 cursor-pointer" onClick={() => handleNavigation("dashboard")}>
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-theme-primary rounded-lg flex items-center justify-center shadow-sm">
              <Cpu className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <span className="text-[#353535] font-semibold text-base sm:text-lg">Pretium AI</span>
          </div>
          
          {/* Page Title - Shows on desktop when provided */}
          {pageTitle && (
            <div className="hidden lg:flex items-center">
              <div className="h-6 w-px bg-slate-300 mx-4" />
              <h1 className="text-slate-900 text-lg font-semibold">{pageTitle}</h1>
            </div>
          )}
          
          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            <Button
              variant={currentPage === "dashboard" ? "secondary" : "ghost"}
              className="rounded-lg hover:bg-theme-primary-10 hover:text-theme-primary"
              onClick={() => handleNavigation("dashboard")}
            >
              <Home className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
            
            {/* Analytics - Only for managers */}
            {currentUser?.role === "manager" && (
              <Button
                variant={currentPage === "analytics" ? "secondary" : "ghost"}
                className="rounded-lg hover:bg-theme-primary-10 hover:text-theme-primary"
                onClick={() => handleNavigation("analytics")}
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Analytics
              </Button>
            )}
            
            {/* My Stats - Always visible for all users */}
            <Button
              variant={currentPage === "mystats" ? "secondary" : "ghost"}
              className="rounded-lg hover:bg-theme-primary-10 hover:text-theme-primary"
              onClick={() => handleNavigation("mystats")}
            >
              <Activity className="w-4 h-4 mr-2" />
              My Stats
            </Button>
            
            <Button
              variant={currentPage === "reviewer" ? "secondary" : "ghost"}
              className="rounded-lg hover:bg-theme-primary-10 hover:text-theme-primary"
              onClick={() => handleNavigation("reviewer")}
            >
              <UserCog className="w-4 h-4 mr-2" />
              Reviewer
            </Button>
          </nav>
        </div>

        {/* Right side - Desktop */}
        <div className="hidden sm:flex items-center gap-3">
          {currentUser && getRoleBadge(currentUser.role)}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar>
                  <AvatarFallback className="bg-theme-primary text-white">
                    {currentUser ? getInitials(currentUser.name) : "U"}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuLabel>
                <div>
                  <p className="text-[#353535]">{currentUser?.name || "User"}</p>
                  <p className="text-xs text-muted-foreground">
                    {currentUser?.role === "manager" && `Manager - ${currentUser.team}`}
                    {currentUser?.role === "technician" && `Technician - ${currentUser.team}`}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              {/* Role Switcher - Demo Only */}
              {onRoleSwitch && (
                <>
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Switch Role (Demo)
                  </DropdownMenuLabel>
                  <DropdownMenuItem 
                    onClick={() => onRoleSwitch("manager")}
                    className={currentUser?.role === "manager" ? "bg-theme-primary-10" : ""}
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    Manager
                    {currentUser?.role === "manager" && (
                      <span className="ml-auto text-theme-primary">✓</span>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => onRoleSwitch("technician")}
                    className={currentUser?.role === "technician" ? "bg-slate-50" : ""}
                  >
                    <Wrench className="w-4 h-4 mr-2" />
                    Technician
                    {currentUser?.role === "technician" && (
                      <span className="ml-auto text-slate-600">✓</span>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              
              <DropdownMenuItem onClick={() => onNavigate("settings")}>
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Mobile Menu Button */}
        <div className="flex sm:hidden items-center gap-2">
          {currentUser && (
            <div className="scale-75">
              {getRoleBadge(currentUser.role)}
            </div>
          )}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] sm:w-[340px]">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
                <SheetDescription className="sr-only">
                  Navigation menu with user profile, page links, and settings
                </SheetDescription>
              </SheetHeader>
              
              {/* User Info */}
              <div className="mt-6 pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-theme-primary text-white">
                      {currentUser ? getInitials(currentUser.name) : "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-[#353535] font-semibold">{currentUser?.name || "User"}</p>
                    <p className="text-xs text-muted-foreground">
                      {currentUser?.role === "manager" && `Manager - ${currentUser.team}`}
                      {currentUser?.role === "technician" && `Technician - ${currentUser.team}`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Navigation Items */}
              <div className="mt-6 space-y-2">
                {/* Dashboard, Analytics, My Stats, and Reviewer moved to bottom nav on mobile - only show other pages here */}
              </div>

              {/* Role Switcher - Demo */}
              {onRoleSwitch && (
                <div className="mt-6 pt-6 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-3 px-2">Switch Role (Demo)</p>
                  <div className="space-y-2">
                    <Button
                      variant={currentUser?.role === "manager" ? "secondary" : "ghost"}
                      className="w-full justify-start h-12 text-base rounded-xl"
                      onClick={() => {
                        onRoleSwitch("manager");
                        setMobileMenuOpen(false);
                      }}
                    >
                      <Shield className="w-5 h-5 mr-3" />
                      Manager
                      {currentUser?.role === "manager" && (
                        <span className="ml-auto text-theme-primary">✓</span>
                      )}
                    </Button>
                    <Button
                      variant={currentUser?.role === "technician" ? "secondary" : "ghost"}
                      className="w-full justify-start h-12 text-base rounded-xl"
                      onClick={() => {
                        onRoleSwitch("technician");
                        setMobileMenuOpen(false);
                      }}
                    >
                      <Wrench className="w-5 h-5 mr-3" />
                      Technician
                      {currentUser?.role === "technician" && (
                        <span className="ml-auto text-slate-600">✓</span>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Settings & Logout */}
              <div className="mt-6 pt-6 border-t border-border space-y-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start h-12 text-base rounded-xl"
                  onClick={() => handleNavigation("settings")}
                >
                  <Settings className="w-5 h-5 mr-3" />
                  Settings
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start h-12 text-base rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => {
                    onLogout();
                    setMobileMenuOpen(false);
                  }}
                >
                  <LogOut className="w-5 h-5 mr-3" />
                  Log out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
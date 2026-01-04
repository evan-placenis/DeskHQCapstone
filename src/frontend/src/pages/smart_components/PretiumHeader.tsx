"use client";

import { Page } from "@/app/pages/config/routes";
import { Button } from "../ui_components/button";
import { 
  Building2, 
  LayoutDashboard, 
  FileEdit, 
  Images,
  Settings,
  LogOut
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui_components/dropdown-menu";
import { Avatar, AvatarFallback } from "../ui_components/avatar";

interface PretiumHeaderProps {
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  currentPage?: Page;
}

export function PretiumHeader({ onNavigate, onLogout, currentPage }: PretiumHeaderProps) {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-6 py-4 max-w-7xl">
        <div className="flex items-center justify-between">
          {/* Logo and Brand */}
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <span className="text-slate-900">Pretium AI</span>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-2">
              <Button 
                variant={currentPage === "dashboard" ? "secondary" : "ghost"}
                className="rounded-lg"
                onClick={() => onNavigate("dashboard")}
              >
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
              <Button 
                variant={currentPage === "editor" ? "secondary" : "ghost"}
                className="rounded-lg"
                onClick={() => onNavigate("editor")}
              >
                <FileEdit className="w-4 h-4 mr-2" />
                Reports
              </Button>
              <Button 
                variant={currentPage === "photos" ? "secondary" : "ghost"}
                className="rounded-lg"
                onClick={() => onNavigate("photos")}
              >
                <Images className="w-4 h-4 mr-2" />
                Photos
              </Button>
            </nav>
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="rounded-lg">
              <Settings className="w-5 h-5" />
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="rounded-lg gap-2">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-blue-100 text-blue-700">SE</AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline">Sarah Engineer</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}

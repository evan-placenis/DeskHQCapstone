"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ROUTES } from "@/app/pages/config/routes";
import { User } from "@/frontend/types";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (userData: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// List of public routes that don't require authentication
const PUBLIC_ROUTES = [
  ROUTES.login,
  ROUTES.register,
  ROUTES.selectOrg,
  ROUTES.orgPassword,
  "/", // Home
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // 1. Check for stored user on mount
    const checkAuth = () => {
      if (typeof window !== "undefined") {
        const storedUser = localStorage.getItem("user");
        
        if (storedUser) {
          try {
            const userObj = JSON.parse(storedUser);
            // Adapt to User interface if needed
            const adaptedUser: User = {
                id: userObj.id,
                name: userObj.name || userObj.user_metadata?.full_name || userObj.email?.split('@')[0] || "User",
                role: userObj.role || "manager",
                email: userObj.email,
                team: userObj.team,
                reportsTo: userObj.reportsTo
            };
            setUser(adaptedUser);
          } catch (e) {
            console.error("Failed to parse user session", e);
            localStorage.removeItem("user");
            setUser(null);
          }
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  useEffect(() => {
    // 2. Protect Routes
    if (!loading) {
      // Check if current path is public
      const isPublicRoute = PUBLIC_ROUTES.some(route => pathname?.startsWith(route));
      
      if (!user && !isPublicRoute) {
        console.log("🔒 Access Denied: Redirecting to login");
        // Ensure we don't redirect if we are already on a public route to avoid loops
        router.push(ROUTES.login);
      }
    }
  }, [user, loading, pathname, router]);

  const login = (userData: User) => {
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
    router.push(ROUTES.dashboard);
  };

  const logout = () => {
    localStorage.removeItem("user");
    setUser(null);
    router.push(ROUTES.login);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {!loading || PUBLIC_ROUTES.some(route => pathname?.startsWith(route)) ? (
        children
      ) : (
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-theme-primary mx-auto mb-4"></div>
            <p className="text-slate-600">Loading application...</p>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}


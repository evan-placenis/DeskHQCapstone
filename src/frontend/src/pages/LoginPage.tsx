"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/frontend/pages/ui_components/button";
import { Input } from "@/frontend/pages/ui_components/input";
import { Label } from "@/frontend/pages/ui_components/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/frontend/pages/ui_components/card";
import { Cpu } from "lucide-react";
import { ROUTES } from "@/app/pages/config/routes";
import { useAuth } from "@/src/app/context/AuthContext";

export function LoginPage() {
  const router = useRouter();
  const { login } = useAuth(); // Use the global login function

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Login successful
      const userData = data.profile || data.user;
      
      if (userData) {
           login(userData); // This handles localStorage and redirect
      } else {
          // Fallback if structure is unexpected
          router.push(ROUTES.dashboard);
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = () => {
    router.push(ROUTES.register);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 bg-theme-primary rounded-xl flex items-center justify-center">
            <Cpu className="w-8 h-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl">Pretium AI</CardTitle>
            <CardDescription className="mt-2">
              Engineering Reporting Platform
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="engineer@company.com"
                required
                className="rounded-lg focus-visible:ring-theme-focus-ring"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                required
                className="rounded-lg focus-visible:ring-theme-focus-ring"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {error}
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded accent-theme-primary focus:ring-theme-focus-ring" />
                <span className="text-slate-600">Remember me</span>
              </label>
              <a href="#" className="text-theme-primary hover:text-theme-primary-hover">
                Forgot password?
              </a>
            </div>
            <Button type="submit" disabled={isLoading} className="w-full rounded-lg bg-theme-primary hover:bg-theme-primary-hover text-white">
              {isLoading ? "Signing In..." : "Sign In"}
            </Button>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-slate-500">or</span>
              </div>
            </div>
            <Button 
              type="button" 
              variant="outline" 
              className="w-full rounded-lg border-slate-300 hover:bg-slate-50"
              onClick={handleRegister}
            >
              Create New Account
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
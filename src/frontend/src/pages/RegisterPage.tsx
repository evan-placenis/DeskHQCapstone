"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/frontend/pages/ui_components/button";
import { Input } from "@/frontend/pages/ui_components/input";
import { Label } from "@/frontend/pages/ui_components/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/frontend/pages/ui_components/card";
import { Cpu, ArrowLeft } from "lucide-react";
import { ROUTES } from "@/app/pages/config/routes";

export function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    // Pass data via query params for now, or use a global state/context in a real app
    const params = new URLSearchParams({ email });
    router.push(`${ROUTES.selectOrg}?${params.toString()}`);
  };

  const handleBack = () => {
    router.push(ROUTES.login);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 bg-theme-primary rounded-xl flex items-center justify-center">
            <Cpu className="w-8 h-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl">Create Account</CardTitle>
            <CardDescription className="mt-2">
              Set up your Pretium AI account
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="register-email">Email</Label>
              <Input
                id="register-email"
                type="email"
                placeholder="engineer@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rounded-lg focus-visible:ring-theme-focus-ring"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="register-password">Password</Label>
              <Input
                id="register-password"
                type="password"
                placeholder="Enter password (min 8 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="rounded-lg focus-visible:ring-theme-focus-ring"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="rounded-lg focus-visible:ring-theme-focus-ring"
              />
            </div>
            
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full rounded-lg bg-theme-primary hover:bg-theme-primary-hover text-white">
              Continue
            </Button>
            
            <Button 
              type="button" 
              variant="ghost" 
              className="w-full rounded-lg"
              onClick={handleBack}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/frontend/pages/ui_components/button";
import { Input } from "@/frontend/pages/ui_components/input";
import { Label } from "@/frontend/pages/ui_components/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/frontend/pages/ui_components/card";
import { Cpu, Building2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { ROUTES } from "@/app/pages/config/routes";

// Mock organization names
const organizationNames: Record<string, string> = {
  "acme-eng": "ACME Engineering Corp",
  "techbuild": "TechBuild Solutions",
  "infrastructure-pro": "Infrastructure Pro Ltd",
  "global-construct": "Global Construction Inc",
  "civil-works": "Civil Works & Associates",
};

function OrganizationPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const organizationId = searchParams.get("organizationId") || "";
  
  const [orgPassword, setOrgPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const organizationName = organizationNames[organizationId] || "Unknown Organization";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    // 1. Validate Organization Password (Mock check)
    // In a real app, this would verify the org password against the backend
    if (orgPassword.length < 6) {
      setError("Please enter a valid organization password");
      setIsSubmitting(false);
      return;
    }

    // 2. Retrieve user password from session storage (stored in RegisterPage)
    // This is a temporary solution for this multi-step flow
    const userPassword = typeof window !== 'undefined' ? sessionStorage.getItem('temp_registration_password') : null;

    if (!userPassword) {
        setError("Session expired. Please start registration again.");
        setIsSubmitting(false);
        // setTimeout(() => router.push(ROUTES.register), 2000);
        return;
    }

    try {
        // 3. Call the Registration API
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email,
                fullName: email.split('@')[0], // Extracting a temporary name from email
                organizationName: organizationName,
                password: userPassword
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Registration failed');
        }

        // 4. Success Handling
        // Clear sensitive data
        if (typeof window !== 'undefined') {
            sessionStorage.removeItem('temp_registration_password');
        }
        
        // Auto-login or redirect to login
        alert("Registration successful! Please sign in.");
        router.push(ROUTES.login);

    } catch (err: any) {
        setError(err.message || "An error occurred during registration");
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    const params = new URLSearchParams({ email });
    router.push(`${ROUTES.selectOrg}?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 bg-theme-primary rounded-xl flex items-center justify-center">
            <Cpu className="w-8 h-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl">Verify Organization</CardTitle>
            <CardDescription className="mt-2">
              Enter your organization's password
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                Email: <span className="text-slate-900">{email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Building2 className="w-4 h-4 text-blue-600" />
                Organization: <span className="text-slate-900">{organizationName}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="org-password">Organization Password</Label>
              <Input
                id="org-password"
                type="password"
                placeholder="Enter organization password"
                value={orgPassword}
                onChange={(e) => setOrgPassword(e.target.value)}
                required
                className="rounded-lg focus-visible:ring-theme-focus-ring"
              />
              <p className="text-xs text-slate-500">
                Contact your organization administrator if you don't have this password
              </p>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {error}
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full rounded-lg bg-theme-primary hover:bg-theme-primary-hover text-white"
            >
              Complete Registration
            </Button>
            
            <Button 
              type="button" 
              variant="ghost" 
              className="w-full rounded-lg"
              onClick={handleBack}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export function OrganizationPasswordPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <OrganizationPasswordForm />
    </Suspense>
  );
}

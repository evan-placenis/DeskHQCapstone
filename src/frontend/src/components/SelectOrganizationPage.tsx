import { useState } from "react";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Cpu, Building2, ArrowLeft } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface SelectOrganizationPageProps {
  email: string;
  onNext: (organizationId: string) => void;
  onBack: () => void;
}

// Mock organization data
const organizations = [
  { id: "acme-eng", name: "ACME Engineering Corp" },
  { id: "techbuild", name: "TechBuild Solutions" },
  { id: "infrastructure-pro", name: "Infrastructure Pro Ltd" },
  { id: "global-construct", name: "Global Construction Inc" },
  { id: "civil-works", name: "Civil Works & Associates" },
];

export function SelectOrganizationPage({ email, onNext, onBack }: SelectOrganizationPageProps) {
  const [selectedOrg, setSelectedOrg] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedOrg) {
      onNext(selectedOrg);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 bg-theme-primary rounded-xl flex items-center justify-center">
            <Cpu className="w-8 h-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl">Select Organization</CardTitle>
            <CardDescription className="mt-2">
              Choose your organization to continue
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-slate-600">
                Registering as: <span className="text-slate-900">{email}</span>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="organization">Organization</Label>
              <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                <SelectTrigger className="rounded-lg focus:ring-theme-focus-ring">
                  <SelectValue placeholder="Select your organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-500" />
                        {org.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-900">
                <strong>Note:</strong> You'll need your organization's password to complete registration.
              </p>
            </div>

            <Button 
              type="submit" 
              className="w-full rounded-lg bg-theme-primary hover:bg-theme-primary-hover text-white"
              disabled={!selectedOrg}
            >
              Continue
            </Button>
            
            <Button 
              type="button" 
              variant="ghost" 
              className="w-full rounded-lg"
              onClick={onBack}
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

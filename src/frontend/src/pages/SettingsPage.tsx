import { AppHeader } from "@/frontend/pages/smart_components/AppHeader";
import { Page } from "@/app/pages/config/routes";
import { Card } from "@/frontend/pages/ui_components/card";
import { Label } from "@/frontend/pages/ui_components/label";
import { Switch } from "@/frontend/pages/ui_components/switch";
import { Button } from "@/frontend/pages/ui_components/button";
import { Input } from "@/frontend/pages/ui_components/input";
import { Separator } from "@/frontend/pages/ui_components/separator";
import {
  User,
  Bell,
  Shield,
  Settings as SettingsIcon,
  Mail,
  Globe,
  Save,
  Building2
} from "lucide-react";

interface SettingsPageProps {
  currentUser: {
    id: number;
    name: string;
    role: "manager" | "technician";
    team?: string;
  };
  onNavigate: (page: Page) => void;
  onLogout: () => void;
}

export function SettingsPage({ currentUser, onNavigate, onLogout }: SettingsPageProps) {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader currentPage="settings" currentUser={currentUser} onNavigate={onNavigate} onLogout={onLogout} />
      
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <SettingsIcon className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-foreground">Settings</h1>
          </div>
          <p className="text-muted-foreground">
            Manage your account settings and preferences
          </p>
        </div>

        <div className="space-y-6">
          {/* Profile Settings */}
          <Card className="border-border shadow-sm">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
                  <User className="w-4 h-4 text-accent-foreground" />
                </div>
                <div>
                  <h3 className="text-card-foreground">Profile</h3>
                  <p className="text-sm text-muted-foreground">Manage your personal information</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-card-foreground">First Name</Label>
                    <Input
                      id="firstName"
                      defaultValue="Sarah"
                      className="bg-input-background border-input hover:border-border-hover"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-card-foreground">Last Name</Label>
                    <Input
                      id="lastName"
                      defaultValue="Johnson"
                      className="bg-input-background border-input hover:border-border-hover"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-card-foreground">Email Address</Label>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      defaultValue="sarah.johnson@pretiumai.com"
                      className="bg-input-background border-input hover:border-border-hover flex-1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company" className="text-card-foreground">Company</Label>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <Input
                      id="company"
                      defaultValue="Pretium Engineering"
                      className="bg-input-background border-input hover:border-border-hover flex-1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role" className="text-card-foreground">Job Title</Label>
                  <Input
                    id="role"
                    defaultValue="Senior Field Engineer"
                    className="bg-input-background border-input hover:border-border-hover"
                  />
                </div>
              </div>

              <Separator className="my-6" />

              <div className="flex justify-end">
                <Button className="bg-primary hover:bg-primary-hover text-primary-foreground">
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </div>
          </Card>

          {/* Notification Settings */}
          <Card className="border-border shadow-sm">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
                  <Bell className="w-4 h-4 text-accent-foreground" />
                </div>
                <div>
                  <h3 className="text-card-foreground">Notifications</h3>
                  <p className="text-sm text-muted-foreground">Configure your notification preferences</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
                  <div>
                    <Label className="text-card-foreground">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive email updates about your projects</p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
                  <div>
                    <Label className="text-card-foreground">Report Updates</Label>
                    <p className="text-sm text-muted-foreground">Get notified when reports are generated</p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
                  <div>
                    <Label className="text-card-foreground">Peer Review Requests</Label>
                    <p className="text-sm text-muted-foreground">Notifications for review assignments</p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
                  <div>
                    <Label className="text-card-foreground">Team Activity</Label>
                    <p className="text-sm text-muted-foreground">Updates about team member activities</p>
                  </div>
                  <Switch />
                </div>
              </div>
            </div>
          </Card>

          {/* Security Settings */}
          <Card className="border-border shadow-sm">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
                  <Shield className="w-4 h-4 text-accent-foreground" />
                </div>
                <div>
                  <h3 className="text-card-foreground">Security</h3>
                  <p className="text-sm text-muted-foreground">Manage your account security</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
                  <div>
                    <Label className="text-card-foreground">Two-Factor Authentication</Label>
                    <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
                  </div>
                  <Button variant="outline" size="sm">
                    Enable
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
                  <div>
                    <Label className="text-card-foreground">Password</Label>
                    <p className="text-sm text-muted-foreground">Last changed 30 days ago</p>
                  </div>
                  <Button variant="outline" size="sm">
                    Change Password
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
                  <div>
                    <Label className="text-card-foreground">Active Sessions</Label>
                    <p className="text-sm text-muted-foreground">Manage your logged-in devices</p>
                  </div>
                  <Button variant="outline" size="sm">
                    View Sessions
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* Regional Settings */}
          <Card className="border-border shadow-sm">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
                  <Globe className="w-4 h-4 text-accent-foreground" />
                </div>
                <div>
                  <h3 className="text-card-foreground">Regional Settings</h3>
                  <p className="text-sm text-muted-foreground">Configure language and timezone</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="language" className="text-card-foreground">Language</Label>
                  <Input
                    id="language"
                    defaultValue="English (US)"
                    className="bg-input-background border-input hover:border-border-hover"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone" className="text-card-foreground">Timezone</Label>
                  <Input
                    id="timezone"
                    defaultValue="Eastern Time (ET)"
                    className="bg-input-background border-input hover:border-border-hover"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dateFormat" className="text-card-foreground">Date Format</Label>
                  <Input
                    id="dateFormat"
                    defaultValue="MM/DD/YYYY"
                    className="bg-input-background border-input hover:border-border-hover"
                  />
                </div>
              </div>

              <Separator className="my-6" />

              <div className="flex justify-end">
                <Button className="bg-primary hover:bg-primary-hover text-primary-foreground">
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
import { useState, useEffect } from "react";
import { Button } from "../ui_components/button";
import { Badge } from "../ui_components/badge";
import { Textarea } from "../ui_components/textarea";
import { Avatar, AvatarFallback } from "../ui_components/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui_components/dialog";
import { Input } from "../ui_components/input";
import { Label } from "../ui_components/label";
import { 
  UserCheck, 
  Search, 
  Check,
  Building,
  Award
} from "lucide-react";

export interface OrgUser {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  specialty?: string;
}

interface RequestPeerReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportTitle: string;
  currentUserId: string;
  onRequestReview: (userId: string, notes: string) => void;
}

export function RequestPeerReviewModal({
  open,
  onOpenChange,
  reportTitle,
  currentUserId,
  onRequestReview,
}: RequestPeerReviewModalProps) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [notes, setNotes] = useState("");
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  useEffect(() => {
    if (open && currentUserId) {
      setIsLoadingUsers(true);
      fetch("/api/organizations/users")
        .then((res) => {
          if (!res.ok) throw new Error(`API error: ${res.status}`);
          return res.json();
        })
        .then((data) => {
          if (data.users && Array.isArray(data.users)) {
            setUsers(data.users);
          } else {
            setUsers([]);
          }
        })
        .catch((err) => {
          console.error("Failed to fetch org users:", err);
          setUsers([]);
        })
        .finally(() => setIsLoadingUsers(false));
    }
  }, [open, currentUserId]);

  // Filter out current user and apply search
  const availableUsers = users.filter(
    (user) =>
      user.id !== currentUserId &&
      (user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.department || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.specialty || "").toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSubmit = () => {
    if (selectedUserId) {
      onRequestReview(selectedUserId, notes);
      
      // Reset form
      setSelectedUserId(null);
      setSearchQuery("");
      setNotes("");
      onOpenChange(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const getAvatarColor = (id: string) => {
    const colors = [
      "bg-theme-primary",
      "bg-theme-secondary",
      "bg-theme-primary-20",
      "bg-theme-secondary-20",
      "bg-theme-primary-30",
      "bg-theme-secondary-30",
    ];
    const hash = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] rounded-xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Request Peer Review</DialogTitle>
          <DialogDescription>
            Select a colleague to review: <span className="font-semibold">{reportTitle}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by name, department, or specialty..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 rounded-lg"
            />
          </div>

          {/* User List */}
          <div className="space-y-2">
            {isLoadingUsers ? (
              <div className="py-8 text-center text-slate-500 text-sm">Loading colleagues...</div>
            ) : availableUsers.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-sm">
                {users.length === 0 ? "No other users in your organization." : "No matching users."}
              </div>
            ) : (
            availableUsers.map((user) => (
              <div
                key={user.id}
                className={`rounded-lg border-2 p-4 cursor-pointer transition-all ${
                  selectedUserId === user.id
                    ? "border-theme-primary bg-theme-primary-10"
                    : "border-slate-200 hover:border-theme-primary-30 hover:bg-theme-primary-5"
                }`}
                onClick={() => setSelectedUserId(user.id)}
              >
                <div className="flex items-start gap-3">
                  <Avatar className={`${getAvatarColor(user.id)} flex-shrink-0`}>
                    <AvatarFallback className="text-white">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <h4 className="text-slate-900">{user.name}</h4>
                        <p className="text-sm text-slate-600">{user.email}</p>
                      </div>
                      {selectedUserId === user.id && (
                        <div className="w-6 h-6 bg-theme-primary-20 rounded-full flex items-center justify-center flex-shrink-0">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs rounded-md">
                        <Building className="w-3 h-3 mr-1" />
                        {user.department}
                      </Badge>
                      <Badge variant="secondary" className="text-xs rounded-md">
                        {user.role}
                      </Badge>
                      {user.specialty && (
                        <Badge variant="outline" className="text-xs rounded-md">
                          <Award className="w-3 h-3 mr-1" />
                          {user.specialty}
                        </Badge>
                      )}
                    </div>

                  </div>
                </div>
              </div>
            ))
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add context or specific areas you'd like the reviewer to focus on..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-lg resize-none"
              rows={3}
            />
          </div>

          {/* Info Box */}
          <div className="bg-theme-primary-10 border border-theme-primary-30 rounded-lg p-3">
            <p className="text-sm text-theme-primary-dark">
              <strong>Tip:</strong> The reviewer will be able to view your report, add comments, 
              and mark their review as complete. You'll be notified once the review is done.
            </p>
          </div>
        </div>

        <DialogFooter className="border-t border-slate-200 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-lg"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedUserId}
            className="bg-theme-primary hover:bg-theme-primary-hover text-white rounded-lg"
          >
            <UserCheck className="w-4 h-4 mr-2" />
            Request Review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
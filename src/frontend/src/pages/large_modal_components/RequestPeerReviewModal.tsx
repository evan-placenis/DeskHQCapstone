import { useState } from "react";
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
  Star,
  Building,
  Award
} from "lucide-react";

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string;
  specialty?: string;
  reviewCount?: number;
}

interface RequestPeerReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportTitle: string;
  currentUserId: number;
  onRequestReview: (userId: number, notes: string) => void;
}

// Mock users - in production this would come from a user management system
const MOCK_USERS: User[] = [
  {
    id: 1,
    name: "John Davis",
    email: "john.davis@pretiumai.com",
    role: "Senior Engineer",
    department: "Structural",
    specialty: "Foundation & Concrete",
    reviewCount: 47
  },
  {
    id: 2,
    name: "Sarah Smith",
    email: "sarah.smith@pretiumai.com",
    role: "Lead Engineer",
    department: "Civil",
    specialty: "Site Assessment",
    reviewCount: 62
  },
  {
    id: 3,
    name: "Michael Chen",
    email: "michael.chen@pretiumai.com",
    role: "Project Manager",
    department: "Management",
    specialty: "BCA & Compliance",
    reviewCount: 38
  },
  {
    id: 4,
    name: "Emily Rodriguez",
    email: "emily.rodriguez@pretiumai.com",
    role: "Senior Engineer",
    department: "Structural",
    specialty: "Steel & Load Analysis",
    reviewCount: 51
  },
  {
    id: 5,
    name: "David Park",
    email: "david.park@pretiumai.com",
    role: "Engineer",
    department: "Safety",
    specialty: "Safety Inspection",
    reviewCount: 29
  },
  {
    id: 6,
    name: "Lisa Thompson",
    email: "lisa.thompson@pretiumai.com",
    role: "Engineer",
    department: "Materials",
    specialty: "Material Testing",
    reviewCount: 34
  },
];

export function RequestPeerReviewModal({
  open,
  onOpenChange,
  reportTitle,
  currentUserId,
  onRequestReview,
}: RequestPeerReviewModalProps) {
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [notes, setNotes] = useState("");

  // Filter out current user and apply search
  const availableUsers = MOCK_USERS.filter(
    (user) =>
      user.id !== currentUserId &&
      (user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.specialty?.toLowerCase().includes(searchQuery.toLowerCase()))
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

  const getAvatarColor = (id: number) => {
    const colors = [
      "bg-blue-500",
      "bg-green-500",
      "bg-theme-primary",
      "bg-orange-500",
      "bg-red-500",
      "bg-indigo-500",
    ];
    return colors[id % colors.length];
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
            {availableUsers.map((user) => (
              <div
                key={user.id}
                className={`rounded-lg border-2 p-4 cursor-pointer transition-all ${
                  selectedUserId === user.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
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
                        <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
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

                    {user.reviewCount && user.reviewCount > 0 && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-slate-600">
                        <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        <span>{user.reviewCount} reviews completed</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
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
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-900">
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
            className="bg-blue-600 hover:bg-blue-700 rounded-lg"
          >
            <UserCheck className="w-4 h-4 mr-2" />
            Request Review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
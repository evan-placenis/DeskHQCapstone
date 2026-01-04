import { useState, useEffect } from "react";
import { AppHeader } from "./AppHeader";
import { NewReportModal } from "./NewReportModal";
import { PhotoDetailModal } from "./PhotoDetailModal";
import { KnowledgeUploadModal, KnowledgeDocument } from "./KnowledgeUploadModal";
import { PhotoUploadModal, PhotoFolder } from "./PhotoUploadModal";
import { PhotoFolderView, Photo } from "./PhotoFolderView";
import { Page, Project } from "../App";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import {
  ArrowLeft,
  Plus,
  FileText,
  Camera,
  Calendar,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Edit,
  Eye,
  BookOpen,
  Download,
  Trash2,
  ExternalLink,
  ChevronDown,
  FolderOpen,
  Volume2,
  Search,
  X,
  Filter,
  Upload
} from "lucide-react";
import { ReportCard } from "./ui/ReportCard";

interface ProjectDetailPageProps {
  project: Project;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  onBack: () => void;
  onSelectReport: (reportId: number) => void;
}

const mockReports = [
  { id: 1, title: "Foundation Assessment - Section A", date: "2025-11-10", status: "Draft", engineer: "John Doe", inspector: "Sarah Smith", reviewer: "John Pogocar", photos: 8, observations: 12 },
  { id: 2, title: "Structural Integrity Analysis", date: "2025-11-07", status: "Draft", engineer: "Sarah Smith", inspector: "Mike Johnson", reviewer: "Emily Davis", photos: 15, observations: 8 },
  { id: 3, title: "Material Quality Inspection", date: "2025-11-05", status: "Draft", engineer: "John Doe", inspector: "Sarah Smith", reviewer: "John Pogocar", photos: 10, observations: 6 },
  { id: 4, title: "Safety Compliance Check", date: "2025-11-03", status: "Draft", engineer: "Mike Johnson", inspector: "Emily Davis", reviewer: "Sarah Smith", photos: 5, observations: 4 },
  { id: 5, title: "Equipment Calibration Report", date: "2025-11-02", status: "Draft", engineer: "Sarah Smith", inspector: "John Pogocar", reviewer: "Mike Johnson", photos: 3, observations: 5 },
  { id: 6, title: "Soil Testing Results", date: "2025-11-01", status: "Draft", engineer: "John Doe", inspector: "Sarah Smith", reviewer: "John Pogocar", photos: 12, observations: 9 },
  { id: 7, title: "Concrete Pour Documentation", date: "2025-10-31", status: "Draft", engineer: "Emily Davis", inspector: "Mike Johnson", reviewer: "Sarah Smith", photos: 18, observations: 11 },
  { id: 8, title: "Rebar Placement Verification", date: "2025-10-30", status: "Draft", engineer: "John Doe", inspector: "Emily Davis", reviewer: "John Pogocar", photos: 14, observations: 7 },
  { id: 9, title: "Waterproofing Inspection", date: "2025-10-29", status: "Draft", engineer: "Mike Johnson", inspector: "Sarah Smith", reviewer: "Emily Davis", photos: 9, observations: 6 },
  { id: 10, title: "Formwork Quality Check", date: "2025-10-28", status: "Draft", engineer: "Sarah Smith", inspector: "John Doe", reviewer: "Mike Johnson", photos: 11, observations: 8 },
  { id: 11, title: "Excavation Progress Report", date: "2025-10-27", status: "Under Review", engineer: "Emily Davis", inspector: "Mike Johnson", reviewer: "Sarah Smith", photos: 16, observations: 10 },
  { id: 12, title: "Steel Frame Installation", date: "2025-10-26", status: "Under Review", engineer: "John Doe", inspector: "Emily Davis", reviewer: "John Pogocar", photos: 20, observations: 13 },
  { id: 13, title: "HVAC System Layout", date: "2025-10-25", status: "Under Review", engineer: "Mike Johnson", inspector: "Sarah Smith", reviewer: "Emily Davis", photos: 12, observations: 9 },
  { id: 14, title: "Electrical Conduit Routing", date: "2025-10-24", status: "Under Review", engineer: "Sarah Smith", inspector: "John Doe", reviewer: "Mike Johnson", photos: 15, observations: 11 },
  { id: 15, title: "Plumbing Rough-In", date: "2025-10-23", status: "Under Review", engineer: "Emily Davis", inspector: "Mike Johnson", reviewer: "Sarah Smith", photos: 13, observations: 8 },
  { id: 16, title: "Fire Protection Systems", date: "2025-10-22", status: "Under Review", engineer: "John Doe", inspector: "Emily Davis", reviewer: "John Pogocar", photos: 10, observations: 7 },
  { id: 17, title: "Roofing Membrane Installation", date: "2025-10-21", status: "Under Review", engineer: "Mike Johnson", inspector: "Sarah Smith", reviewer: "Emily Davis", photos: 17, observations: 12 },
  { id: 18, title: "Window Frame Installation", date: "2025-10-20", status: "Under Review", engineer: "Sarah Smith", inspector: "John Doe", reviewer: "Mike Johnson", photos: 14, observations: 9 },
  { id: 19, title: "Insulation Assessment", date: "2025-10-19", status: "Under Review", engineer: "Emily Davis", inspector: "Mike Johnson", reviewer: "Sarah Smith", photos: 11, observations: 6 },
  { id: 20, title: "Drywall Installation Progress", date: "2025-10-18", status: "Under Review", engineer: "John Doe", inspector: "Emily Davis", reviewer: "John Pogocar", photos: 8, observations: 5 },
  { id: 21, title: "Flooring Substrate Preparation", date: "2025-10-17", status: "Completed", engineer: "Mike Johnson", inspector: "Sarah Smith", reviewer: "Emily Davis", photos: 19, observations: 14 },
  { id: 22, title: "Elevator Shaft Inspection", date: "2025-10-16", status: "Completed", engineer: "Sarah Smith", inspector: "John Doe", reviewer: "Mike Johnson", photos: 12, observations: 8 },
  { id: 23, title: "Stairwell Construction Review", date: "2025-10-15", status: "Completed", engineer: "Emily Davis", inspector: "Mike Johnson", reviewer: "Sarah Smith", photos: 15, observations: 10 },
  { id: 24, title: "Parking Garage Lighting", date: "2025-10-14", status: "Completed", engineer: "John Doe", inspector: "Emily Davis", reviewer: "John Pogocar", photos: 13, observations: 9 },
  { id: 25, title: "Landscape Grading Plan", date: "2025-10-13", status: "Completed", engineer: "Mike Johnson", inspector: "Sarah Smith", reviewer: "Emily Davis", photos: 16, observations: 11 },
  { id: 26, title: "Retaining Wall Stability", date: "2025-10-12", status: "Completed", engineer: "Sarah Smith", inspector: "John Doe", reviewer: "Mike Johnson", photos: 14, observations: 12 },
  { id: 27, title: "Storm Drainage System", date: "2025-10-11", status: "Completed", engineer: "Emily Davis", inspector: "Mike Johnson", reviewer: "Sarah Smith", photos: 17, observations: 13 },
  { id: 28, title: "Accessibility Compliance", date: "2025-10-10", status: "Completed", engineer: "John Doe", inspector: "Emily Davis", reviewer: "John Pogocar", photos: 11, observations: 7 },
  { id: 29, title: "Emergency Exit Signage", date: "2025-10-09", status: "Completed", engineer: "Mike Johnson", inspector: "Sarah Smith", reviewer: "Emily Davis", photos: 9, observations: 6 },
  { id: 30, title: "Final Punch List Items", date: "2025-10-08", status: "Completed", engineer: "Sarah Smith", inspector: "John Doe", reviewer: "Mike Johnson", photos: 22, observations: 15 },
];

const mockPhotos = [
  {
    id: 1,
    url: "https://images.unsplash.com/photo-1599995903128-531fc7fb694b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjBzaXRlfGVufDF8fHx8MTc2Mjg2NTEwNnww&ixlib=rb-4.1.0&q=80&w=1080",
    name: "Foundation Overview",
    date: "2025-11-10",
    location: "Section A",
    linkedReport: "Foundation Assessment",
    description: "Foundation concrete pour inspection showing smooth finish with uniform color distribution. No visible surface defects, cracking, or segregation observed. Pour completed successfully with proper consolidation. Temperature at time of inspection: 21°C.",
    folderId: 1
  },
  {
    id: 2,
    url: "https://images.unsplash.com/photo-1691947563165-28011f40d786?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidWlsZGluZyUyMGluZnJhc3RydWN0dXJlfGVufDF8fHx8MTc2Mjg5NTU4Mnww&ixlib=rb-4.1.0&q=80&w=1080",
    name: "Structural Support",
    date: "2025-11-10",
    location: "Section A",
    linkedReport: "Foundation Assessment",
    description: "Steel reinforcement cage installation. Rebar spacing verified at 200mm centers, cover maintained at 50mm minimum. All connections properly tied and secured. Inspection confirms compliance with structural drawings SD-101.",
    folderId: 1
  },
  {
    id: 3,
    url: "https://images.unsplash.com/photo-1645258044234-f4ba2655baf1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbmdpbmVlcmluZyUyMGVxdWlwbWVudHxlbnwxfHx8fDE3NjI4OTU1ODJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    name: "Equipment Setup",
    date: "2025-11-10",
    location: "Section B",
    linkedReport: null,
    description: "Testing equipment positioned for material sampling. Calibration verified current, equipment ID: TE-2847. Ready for concrete cylinder testing per ASTM C39 standards.",
    folderId: 1
  },
  {
    id: 4,
    url: "https://images.unsplash.com/photo-1738528575208-b9ccdca8acaf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmR1c3RyaWFsJTIwc2l0ZXxlbnwxfHx8fDE3NjI4OTU1ODJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    name: "Site Overview",
    date: "2025-11-10",
    location: "Main Area",
    linkedReport: null,
    description: "",
    folderId: 1
  },
  {
    id: 5,
    url: "https://images.unsplash.com/photo-1599995903128-531fc7fb694b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjBzaXRlfGVufDF8fHx8MTc2Mjg2NTEwNnww&ixlib=rb-4.1.0&q=80&w=1080",
    name: "Concrete Detail",
    date: "2025-11-10",
    location: "Section C",
    linkedReport: "Foundation Assessment",
    description: "Close-up view of concrete surface texture. Aggregate distribution appears uniform, no honeycombing detected. Surface finish meets ACI 301 Class A requirements.",
    folderId: 1
  },
  {
    id: 6,
    url: "https://images.unsplash.com/photo-1691947563165-28011f40d786?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidWlsZGluZyUyMGluZnJhc3RydWN0dXJlfGVufDF8fHx8MTc2Mjg5NTU4Mnww&ixlib=rb-4.1.0&q=80&w=1080",
    name: "Load Test Setup",
    date: "2025-11-10",
    location: "Section A",
    linkedReport: "Foundation Assessment",
    description: "Load testing apparatus in position for beam capacity verification. Initial load applied at 5 kN, increments of 2.5 kN planned up to 50 kN design load. Deflection gauges installed at mid-span and quarter points.",
    folderId: 1
  },
  {
    id: 7,
    url: "https://images.unsplash.com/photo-1645258044234-f4ba2655baf1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbmdpbmVlcmluZyUyMGVxdWlwbWVudHxlbnwxfHx8fDE3NjI4OTU1ODJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    name: "Rebar Installation",
    date: "2025-11-10",
    location: "Section A",
    linkedReport: "Foundation Assessment",
    description: "Vertical reinforcement bars positioned according to specifications. All bars checked for proper alignment and spacing.",
    folderId: 1
  },
  {
    id: 8,
    url: "https://images.unsplash.com/photo-1738528575208-b9ccdca8acaf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmR1c3RyaWFsJTIwc2l0ZXxlbnwxfHx8fDE3NjI4OTU1ODJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    name: "Formwork Installation",
    date: "2025-11-10",
    location: "Section B",
    linkedReport: null,
    description: "Formwork erected and braced. All connections tight and secure.",
    folderId: 1
  },
  {
    id: 9,
    url: "https://images.unsplash.com/photo-1599995903128-531fc7fb694b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjBzaXRlfGVufDF8fHx8MTc2Mjg2NTEwNnww&ixlib=rb-4.1.0&q=80&w=1080",
    name: "Foundation Wall East",
    date: "2025-11-10",
    location: "East Section",
    linkedReport: "Foundation Assessment",
    description: "East foundation wall showing proper concrete placement and finishing.",
    folderId: 1
  },
  {
    id: 10,
    url: "https://images.unsplash.com/photo-1691947563165-28011f40d786?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidWlsZGluZyUyMGluZnJhc3RydWN0dXJlfGVufDF8fHx8MTc2Mjg5NTU4Mnww&ixlib=rb-4.1.0&q=80&w=1080",
    name: "Column Base Detail",
    date: "2025-11-10",
    location: "Grid A3",
    linkedReport: null,
    description: "Column base showing anchor bolt placement and grout pad preparation.",
    folderId: 1
  },
  {
    id: 11,
    url: "https://images.unsplash.com/photo-1645258044234-f4ba2655baf1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbmdpbmVlcmluZyUyMGVxdWlwbWVudHxlbnwxfHx8fDE3NjI4OTU1ODJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    name: "Measurement Equipment",
    date: "2025-11-09",
    location: "Section B",
    linkedReport: null,
    description: "Surveying equipment in use for grade verification. Elevation checks completed.",
    folderId: 2
  },
  {
    id: 12,
    url: "https://images.unsplash.com/photo-1738528575208-b9ccdca8acaf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmR1c3RyaWFsJTIwc2l0ZXxlbnwxfHx8fDE3NjI4OTU1ODJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    name: "North Elevation",
    date: "2025-11-09",
    location: "North Side",
    linkedReport: null,
    description: "Overall view of north elevation showing progress.",
    folderId: 2
  },
  {
    id: 13,
    url: "https://images.unsplash.com/photo-1599995903128-531fc7fb694b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjBzaXRlfGVufDF8fHx8MTc2Mjg2NTEwNnww&ixlib=rb-4.1.0&q=80&w=1080",
    name: "Material Stockpile",
    date: "2025-11-09",
    location: "Staging Area",
    linkedReport: null,
    description: "Aggregate stockpile showing proper segregation and protection from contamination.",
    folderId: 2
  },
  {
    id: 14,
    url: "https://images.unsplash.com/photo-1691947563165-28011f40d786?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidWlsZGluZyUyMGluZnJhc3RydWN0dXJlfGVufDF8fHx8MTc2Mjg5NTU4Mnww&ixlib=rb-4.1.0&q=80&w=1080",
    name: "Steel Beam Connection",
    date: "2025-11-09",
    location: "Level 2",
    linkedReport: null,
    description: "Beam-to-column connection detail. All bolts torqued to specification.",
    folderId: 2
  },
  {
    id: 15,
    url: "https://images.unsplash.com/photo-1645258044234-f4ba2655baf1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbmdpbmVlcmluZyUyMGVxdWlwbWVudHxlbnwxfHx8fDE3NjI4OTU1ODJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    name: "Testing Lab Setup",
    date: "2025-11-09",
    location: "Site Office",
    linkedReport: null,
    description: "On-site testing lab with calibrated equipment ready for material testing.",
    folderId: 2
  },
  {
    id: 16,
    url: "https://images.unsplash.com/photo-1738528575208-b9ccdca8acaf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmR1c3RyaWFsJTIwc2l0ZXxlbnwxfHx8fDE3NjI4OTU1ODJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    name: "Access Road Condition",
    date: "2025-11-09",
    location: "Entry",
    linkedReport: null,
    description: "Site access road showing adequate base preparation and drainage.",
    folderId: 2
  },
  {
    id: 17,
    url: "https://images.unsplash.com/photo-1599995903128-531fc7fb694b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjBzaXRlfGVufDF8fHx8MTc2Mjg2NTEwNnww&ixlib=rb-4.1.0&q=80&w=1080",
    name: "Safety Barriers",
    date: "2025-11-09",
    location: "Perimeter",
    linkedReport: null,
    description: "Perimeter safety fencing installed and properly maintained.",
    folderId: 2
  },
  {
    id: 18,
    url: "https://images.unsplash.com/photo-1691947563165-28011f40d786?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidWlsZGluZyUyMGluZnJhc3RydWN0dXJlfGVufDF8fHx8MTc2Mjg5NTU4Mnww&ixlib=rb-4.1.0&q=80&w=1080",
    name: "Utility Connection",
    date: "2025-11-09",
    location: "South Side",
    linkedReport: null,
    description: "Temporary utility connection installed per site plan requirements.",
    folderId: 2
  },
  {
    id: 19,
    url: "https://images.unsplash.com/photo-1645258044234-f4ba2655baf1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbmdpbmVlcmluZyUyMGVxdWlwbWVudHxlbnwxfHx8fDE3NjI4OTU1ODJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    name: "Drainage System",
    date: "2025-11-09",
    location: "West Side",
    linkedReport: null,
    description: "Storm drainage system installation in progress. Proper slope verified.",
    folderId: 2
  },
  {
    id: 20,
    url: "https://images.unsplash.com/photo-1738528575208-b9ccdca8acaf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmR1c3RyaWFsJTIwc2l0ZXxlbnwxfHx8fDE3NjI4OTU1ODJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    name: "Excavation Depth Check",
    date: "2025-11-09",
    location: "Section C",
    linkedReport: null,
    description: "Excavation depth verification completed. Bottom elevation meets specifications.",
    folderId: 2
  },
  {
    id: 21,
    url: "https://images.unsplash.com/photo-1599995903128-531fc7fb694b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjBzaXRlfGVufDF8fHx8MTc2Mjg2NTEwNnww&ixlib=rb-4.1.0&q=80&w=1080",
    name: "Structural Analysis Point",
    date: "2025-11-07",
    location: "Section C",
    linkedReport: "Structural Integrity Analysis",
    description: "Key structural point showing concrete-steel interface condition.",
    folderId: 3
  },
  {
    id: 22,
    url: "https://images.unsplash.com/photo-1691947563165-28011f40d786?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidWlsZGluZyUyMGluZnJhc3RydWN0dXJlfGVufDF8fHx8MTc2Mjg5NTU4Mnww&ixlib=rb-4.1.0&q=80&w=1080",
    name: "Joint Detail",
    date: "2025-11-07",
    location: "Grid B2",
    linkedReport: "Structural Integrity Analysis",
    description: "Construction joint showing proper surface preparation and bonding.",
    folderId: 3
  },
  {
    id: 23,
    url: "https://images.unsplash.com/photo-1645258044234-f4ba2655baf1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbmdpbmVlcmluZyUyMGVxdWlwbWVudHxlbnwxfHx8fDE3NjI4OTU1ODJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    name: "Core Sample Location",
    date: "2025-11-07",
    location: "Section A",
    linkedReport: "Structural Integrity Analysis",
    description: "Location marked for concrete core sampling. Will be tested for compressive strength.",
    folderId: 3
  },
  {
    id: 24,
    url: "https://images.unsplash.com/photo-1738528575208-b9ccdca8acaf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmR1c3RyaWFsJTIwc2l0ZXxlbnwxfHx8fDE3NjI4OTU1ODJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    name: "Slab Thickness Verification",
    date: "2025-11-07",
    location: "Level 1",
    linkedReport: "Structural Integrity Analysis",
    description: "Slab thickness measured and verified to meet design specifications.",
    folderId: 3
  },
  {
    id: 25,
    url: "https://images.unsplash.com/photo-1599995903128-531fc7fb694b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjBzaXRlfGVufDF8fHx8MTc2Mjg2NTEwNnww&ixlib=rb-4.1.0&q=80&w=1080",
    name: "Reinforcement Spacing",
    date: "2025-11-07",
    location: "Section D",
    linkedReport: "Structural Integrity Analysis",
    description: "Rebar spacing verification using measuring device. All within tolerance.",
    folderId: 3
  },
  {
    id: 26,
    url: "https://images.unsplash.com/photo-1691947563165-28011f40d786?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidWlsZGluZyUyMGluZnJhc3RydWN0dXJlfGVufDF8fHx8MTc2Mjg5NTU4Mnww&ixlib=rb-4.1.0&q=80&w=1080",
    name: "Anchor Bolt Pattern",
    date: "2025-11-07",
    location: "Grid C4",
    linkedReport: null,
    description: "Anchor bolt layout verified against shop drawings. All dimensions correct.",
    folderId: 3
  },
  {
    id: 27,
    url: "https://images.unsplash.com/photo-1645258044234-f4ba2655baf1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbmdpbmVlcmluZyUyMGVxdWlwbWVudHxlbnwxfHx8fDE3NjI4OTU1ODJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    name: "Crack Monitoring Point",
    date: "2025-11-07",
    location: "Section B",
    linkedReport: "Structural Integrity Analysis",
    description: "Minor hairline crack identified and marked for monitoring. Width less than allowable limit.",
    folderId: 3
  },
  {
    id: 28,
    url: "https://images.unsplash.com/photo-1738528575208-b9ccdca8acaf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmR1c3RyaWFsJTIwc2l0ZXxlbnwxfHx8fDE3NjI4OTU1ODJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    name: "Waterproofing Application",
    date: "2025-11-07",
    location: "Below Grade",
    linkedReport: null,
    description: "Waterproofing membrane application in progress on foundation walls.",
    folderId: 3
  },
  {
    id: 29,
    url: "https://images.unsplash.com/photo-1599995903128-531fc7fb694b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjBzaXRlfGVufDF8fHx8MTc2Mjg2NTEwNnww&ixlib=rb-4.1.0&q=80&w=1080",
    name: "Deflection Measurement",
    date: "2025-11-07",
    location: "Beam Span 3",
    linkedReport: "Structural Integrity Analysis",
    description: "Deflection gauge reading taken under test load. Results within acceptable range.",
    folderId: 3
  },
  {
    id: 30,
    url: "https://images.unsplash.com/photo-1691947563165-28011f40d786?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidWlsZGluZyUyMGluZnJhc3RydWN0dXJlfGVufDF8fHx8MTc2Mjg5NTU4Mnww&ixlib=rb-4.1.0&q=80&w=1080",
    name: "Overall Progress Shot",
    date: "2025-11-07",
    location: "Site Wide",
    linkedReport: "Structural Integrity Analysis",
    description: "Wide angle view showing overall construction progress at end of site visit.",
    folderId: 3
  },
];

const mockPhotoFolders: PhotoFolder[] = [
  {
    id: 1,
    name: "Site Visit 1 - 2025-11-10 - JD",
    createdDate: "2025-11-10"
  },
  {
    id: 2,
    name: "Site Visit 2 - 2025-11-09 - SS",
    createdDate: "2025-11-09"
  },
  {
    id: 3,
    name: "Site Visit 3 - 2025-11-07 - JD",
    createdDate: "2025-11-07"
  },
];

const mockKnowledgeDocuments: KnowledgeDocument[] = [
  {
    id: 1,
    name: "ACI 318-19 Building Code Requirements.pdf",
    type: "standard",
    description: "American Concrete Institute building code requirements for structural concrete. Reference for all concrete-related inspections and specifications.",
    uploadDate: "2025-10-15",
    fileSize: "4.2 MB",
    fileType: "PDF"
  },
  {
    id: 2,
    name: "Project Specifications - Downtown Plaza.docx",
    type: "specification",
    description: "Complete technical specifications for the Downtown Plaza project. Includes material requirements, quality standards, and acceptance criteria.",
    uploadDate: "2025-10-18",
    fileSize: "856 KB",
    fileType: "DOCX"
  },
  {
    id: 3,
    name: "ASTM C39 Testing Procedures.pdf",
    type: "standard",
    description: "Standard test method for compressive strength of cylindrical concrete specimens. Follow for all concrete testing procedures.",
    uploadDate: "2025-10-20",
    fileSize: "1.1 MB",
    fileType: "PDF"
  },
  {
    id: 4,
    name: "Previous Phase 1 Foundation Report.pdf",
    type: "previous_report",
    description: "Completed foundation assessment from Phase 1. Use as reference for report format and observation style.",
    uploadDate: "2025-10-22",
    fileSize: "2.8 MB",
    fileType: "PDF"
  },
];

export function ProjectDetailPage({ 
  project, 
  onNavigate, 
  onLogout, 
  onBack,
  onSelectReport 
}: ProjectDetailPageProps) {
  const [isNewReportModalOpen, setIsNewReportModalOpen] = useState(false);
  const [reports, setReports] = useState(mockReports);
  const [photos, setPhotos] = useState(mockPhotos);
  const [selectedPhoto, setSelectedPhoto] = useState<typeof mockPhotos[0] | null>(null);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [knowledgeDocuments, setKnowledgeDocuments] = useState<KnowledgeDocument[]>(mockKnowledgeDocuments);
  const [isKnowledgeUploadModalOpen, setIsKnowledgeUploadModalOpen] = useState(false);
  const [isPhotoUploadModalOpen, setIsPhotoUploadModalOpen] = useState(false);
  const [photoFolders, setPhotoFolders] = useState<PhotoFolder[]>(mockPhotoFolders);
  
  // Photo filter states
  const [photoSearchKeyword, setPhotoSearchKeyword] = useState("");
  const [photoFilterDateStart, setPhotoFilterDateStart] = useState("");
  const [photoFilterDateEnd, setPhotoFilterDateEnd] = useState("");
  const [photoFilterUser, setPhotoFilterUser] = useState("all");
  const [photoGridSize, setPhotoGridSize] = useState(2); // 0=smallest, 1=small, 2=medium, 3=large

  const handleUploadJobSheet = () => {
    // Create a file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx,.jpg,.jpeg,.png';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        // In a real app, this would upload the file to the server
        console.log('Uploading job sheet:', file.name);
        // For demo, you could add it to knowledge documents or show a success message
        const newDoc: KnowledgeDocument = {
          id: knowledgeDocuments.length + 1,
          name: file.name,
          type: 'job_sheet',
          description: 'Job information sheet',
          uploadDate: new Date().toISOString().split('T')[0],
          fileSize: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
          fileType: file.name.split('.').pop()?.toUpperCase() || 'FILE'
        };
        setKnowledgeDocuments([newDoc, ...knowledgeDocuments]);
        alert(`Job sheet "${file.name}" uploaded successfully!`);
      }
    };
    input.click();
  };

  const handleCreateReport = (reportData: { title: string; description: string }) => {
    // In a real app, this would create a new report and navigate to it
    console.log("Creating report:", reportData);
    // For demo, just navigate to report viewer with a new ID
    onSelectReport(999); // Use a unique ID for the new report
  };

  const handleStatusChange = (reportId: number, newStatus: string) => {
    setReports(reports.map(report => 
      report.id === reportId ? { ...report, status: newStatus } : report
    ));
  };

  const handlePhotoClick = (photo: typeof mockPhotos[0]) => {
    setSelectedPhoto(photo);
    setIsPhotoModalOpen(true);
  };

  const handleSavePhotoDescription = (photoId: number, description: string) => {
    setPhotos(photos.map(photo =>
      photo.id === photoId ? { ...photo, description } : photo
    ));
  };

  const handlePhotoNavigate = (direction: "prev" | "next") => {
    if (!selectedPhoto) return;
    const currentIndex = photos.findIndex(p => p.id === selectedPhoto.id);
    let newIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;
    if (newIndex >= 0 && newIndex < photos.length) {
      setSelectedPhoto(photos[newIndex]);
    }
  };

  const getNavigationState = () => {
    if (!selectedPhoto) return { prev: false, next: false };
    const currentIndex = photos.findIndex(p => p.id === selectedPhoto.id);
    return {
      prev: currentIndex > 0,
      next: currentIndex < photos.length - 1
    };
  };

  const handleUploadKnowledge = (doc: Omit<KnowledgeDocument, "id" | "uploadDate">) => {
    const newDoc: KnowledgeDocument = {
      ...doc,
      id: Math.max(...knowledgeDocuments.map(d => d.id), 0) + 1,
      uploadDate: new Date().toISOString().split('T')[0]
    };
    setKnowledgeDocuments([...knowledgeDocuments, newDoc]);
  };

  const handleDeleteKnowledge = (id: number) => {
    setKnowledgeDocuments(knowledgeDocuments.filter(doc => doc.id !== id));
  };

  const getDocumentTypeIcon = (type: KnowledgeDocument["type"]) => {
    switch (type) {
      case "specification": return "📋";
      case "standard": return "⚖️";
      case "previous_report": return "📊";
      case "guideline": return "📖";
      case "reference": return "📚";
      case "job_sheet": return "💼";
      default: return "📄";
    }
  };

  const getDocumentTypeName = (type: KnowledgeDocument["type"]) => {
    switch (type) {
      case "specification": return "Specification";
      case "standard": return "Standard";
      case "previous_report": return "Previous Report";
      case "guideline": return "Guideline";
      case "reference": return "Reference";
      case "job_sheet": return "Job Sheet";
      default: return "Other";
    }
  };

  const handleUploadPhotos = (files: File[], folderId: number, folderName?: string) => {
    let targetFolderId = folderId;
    
    // If creating a new folder
    if (folderId === -1 && folderName) {
      const newFolder: PhotoFolder = {
        id: Math.max(...photoFolders.map(f => f.id), 0) + 1,
        name: folderName,
        createdDate: new Date().toISOString().split('T')[0]
      };
      setPhotoFolders([...photoFolders, newFolder]);
      targetFolderId = newFolder.id;
    }

    // Create photo entries for uploaded files
    const newPhotos = files.map((file, index) => ({
      id: Math.max(...photos.map(p => p.id), 0) + index + 1,
      url: URL.createObjectURL(file), // In production, this would be uploaded to storage
      name: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
      date: new Date().toISOString().split('T')[0],
      location: "Project Site",
      linkedReport: null,
      description: "",
      folderId: targetFolderId
    }));

    setPhotos([...photos, ...newPhotos]);
  };

  const handleDeletePhoto = (photoId: number) => {
    setPhotos(photos.filter(p => p.id !== photoId));
  };

  const handleDeleteFolder = (folderId: number) => {
    // Delete all photos in the folder
    setPhotos(photos.filter(p => p.folderId !== folderId));
    // Delete the folder
    setPhotoFolders(photoFolders.filter(f => f.id !== folderId));
  };

  const handleAudioTimelineClick = (folderId: number) => {
    // Navigate to audio timeline for this folder
    onNavigate("audio-timeline");
  };
  
  // Extract unique users from folder names (initials at the end)
  const extractUsersFromFolders = () => {
    const users = new Set<string>();
    photoFolders.forEach(folder => {
      const match = folder.name.match(/- ([A-Z]{2,})$/);
      if (match) {
        users.add(match[1]);
      }
    });
    return Array.from(users).sort();
  };
  
  // Extract unique dates from folders
  const extractDatesFromFolders = () => {
    const dates = new Set<string>();
    photoFolders.forEach(folder => {
      if (folder.createdDate) {
        dates.add(folder.createdDate);
      }
    });
    return Array.from(dates).sort().reverse(); // Most recent first
  };
  
  // Apply filters to photos and folders
  const applyPhotoFilters = () => {
    let filteredFolderIds = new Set<number>();
    let filteredPhotosList = photos;
    
    // Filter by user (folder name contains user initials)
    if (photoFilterUser !== "all") {
      const matchingFolders = photoFolders.filter(folder => 
        folder.name.includes(`- ${photoFilterUser}`)
      );
      filteredFolderIds = new Set(matchingFolders.map(f => f.id));
      filteredPhotosList = filteredPhotosList.filter(p => filteredFolderIds.has(p.folderId));
    }
    
    // Filter by date range
    if (photoFilterDateStart || photoFilterDateEnd) {
      const startDate = photoFilterDateStart ? new Date(photoFilterDateStart) : null;
      const endDate = photoFilterDateEnd ? new Date(photoFilterDateEnd) : null;
      filteredPhotosList = filteredPhotosList.filter(p => {
        const photoDate = new Date(p.date);
        return (!startDate || photoDate >= startDate) && (!endDate || photoDate <= endDate);
      });
      // Also filter folders by date
      const matchingFolders = photoFolders.filter(folder => {
        const folderDate = new Date(folder.createdDate);
        return (!startDate || folderDate >= startDate) && (!endDate || folderDate <= endDate);
      });
      if (photoFilterUser !== "all") {
        // Intersection of user and date filters
        filteredFolderIds = new Set(
          Array.from(filteredFolderIds).filter(id => matchingFolders.some(f => f.id === id))
        );
      } else {
        filteredFolderIds = new Set(matchingFolders.map(f => f.id));
      }
    }
    
    // Filter by keyword (search in photo name, description, location)
    if (photoSearchKeyword) {
      const keyword = photoSearchKeyword.toLowerCase();
      filteredPhotosList = filteredPhotosList.filter(p => 
        p.name.toLowerCase().includes(keyword) ||
        p.description.toLowerCase().includes(keyword) ||
        p.location.toLowerCase().includes(keyword)
      );
    }
    
    // Get folders that have photos after filtering
    const foldersWithPhotos = new Set(filteredPhotosList.map(p => p.folderId));
    
    // If we have folder-based filters, use those, otherwise use folders with matching photos
    const finalFilteredFolderIds = (photoFilterUser !== "all" || photoFilterDateStart || photoFilterDateEnd) && filteredFolderIds.size > 0
      ? Array.from(filteredFolderIds).filter(id => foldersWithPhotos.has(id))
      : Array.from(foldersWithPhotos);
    
    const filteredFolders = photoFolders.filter(f => finalFilteredFolderIds.includes(f.id));
    
    return {
      folders: filteredFolders,
      photos: filteredPhotosList
    };
  };
  
  const { folders: filteredFolders, photos: filteredPhotos } = applyPhotoFilters();
  const hasActiveFilters = photoSearchKeyword || photoFilterDateStart || photoFilterDateEnd || photoFilterUser !== "all";
  const availableUsers = extractUsersFromFolders();
  const availableDates = extractDatesFromFolders();

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Computed values
  const totalPhotos = photos.length;
  const audioFiles: any[] = []; // Mock data - would come from state in real app
  const knowledgeDocs = knowledgeDocuments;

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader 
        currentPage="project" 
        onNavigate={onNavigate} 
        onLogout={onLogout}
        pageTitle="Project"
      />
      
      <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 max-w-7xl">
        {/* Page Header */}
        <div className="mb-6 sm:mb-8">
          <Button
            variant="ghost"
            onClick={onBack}
            className="mb-4 hover:bg-slate-100 rounded-lg text-sm sm:text-base h-10 sm:h-auto px-3 sm:px-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>

          {/* Project Title Banner - Green with White Text */}
          <Card className="rounded-xl shadow-sm border-2 border-theme-primary bg-theme-primary p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-white text-xl sm:text-2xl lg:text-3xl font-bold">{project.name}</h1>
                  <Badge
                    variant={project.status === "Active" ? "default" : "secondary"}
                    className="rounded-md text-xs sm:text-sm bg-white text-theme-primary"
                  >
                    {project.status}
                  </Badge>
                </div>
                <p className="text-white/90 text-sm sm:text-base">{project.description}</p>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  size="lg"
                  className="bg-white hover:bg-white/90 text-theme-primary rounded-lg shadow-md text-sm sm:text-base h-10 sm:h-auto font-semibold"
                  onClick={() => setIsNewReportModalOpen(true)}
                >
                  <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  New Report
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="bg-white hover:bg-white/90 text-theme-primary rounded-lg shadow-md text-sm sm:text-base h-10 sm:h-auto font-semibold border-white"
                  onClick={handleUploadJobSheet}
                >
                  <Upload className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  Upload Job Sheet
                </Button>
              </div>
            </div>
          </Card>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card className="p-3 sm:p-6 rounded-lg sm:rounded-xl border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-slate-600 mb-1">Draft</p>
                  <p className="text-slate-900 text-lg sm:text-2xl leading-none font-bold">{reports.filter(r => r.status === "Draft").length}</p>
                </div>
                <div className="w-7 h-7 sm:w-10 sm:h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Clock className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-slate-600" />
                </div>
              </div>
            </Card>

            <Card className="p-3 sm:p-6 rounded-lg sm:rounded-xl border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-slate-600 mb-1">Under Review</p>
                  <p className="text-slate-900 text-lg sm:text-2xl leading-none font-bold">{reports.filter(r => r.status === "Under Review").length}</p>
                </div>
                <div className="w-7 h-7 sm:w-10 sm:h-10 bg-theme-status-review-light rounded-lg flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-theme-status-review" />
                </div>
              </div>
            </Card>

            <Card className="p-3 sm:p-6 rounded-lg sm:rounded-xl border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-slate-600 mb-1">Completed</p>
                  <p className="text-slate-900 text-lg sm:text-2xl leading-none font-bold">{reports.filter(r => r.status === "Completed").length}</p>
                </div>
                <div className="w-7 h-7 sm:w-10 sm:h-10 bg-theme-status-complete-light rounded-lg flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-theme-status-complete" />
                </div>
              </div>
            </Card>

            <Card className="p-3 sm:p-6 rounded-lg sm:rounded-xl border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-slate-600 mb-1">Total</p>
                  <p className="text-slate-900 text-lg sm:text-2xl leading-none font-bold">{reports.length}</p>
                </div>
                <div className="w-7 h-7 sm:w-10 sm:h-10 bg-theme-primary-10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-theme-primary" />
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Tabs for Reports and Photos */}
        <Tabs defaultValue="reports" className="space-y-6">
          <TabsList className="bg-white border border-slate-200 rounded-lg p-1">
            <TabsTrigger value="reports" className="rounded-md">
              <FileText className="w-4 h-4 mr-2" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="photos" className="rounded-md">
              <Camera className="w-4 h-4 mr-2" />
              Photos
            </TabsTrigger>
            <TabsTrigger value="knowledge" className="rounded-md">
              <BookOpen className="w-4 h-4 mr-2" />
              Knowledge Base
            </TabsTrigger>
          </TabsList>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-4">
            <Card className="rounded-xl shadow-sm border-slate-200">
              <CardHeader>
                <CardTitle className="font-bold">Project Reports</CardTitle>
                <CardDescription>All observation reports for this project, organized by status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Draft Reports */}
                {reports.filter(r => r.status === "Draft").length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="w-4 h-4 text-theme-status-draft" />
                      <h3 className="text-slate-900">Draft</h3>
                      <Badge variant="secondary" className="rounded-md ml-auto">
                        {reports.filter(r => r.status === "Draft").length}
                      </Badge>
                    </div>
                    <div className="space-y-1.5 sm:space-y-2 max-h-[500px] overflow-y-auto">
                      {reports.filter(r => r.status === "Draft").map((report) => (
                        <ReportCard 
                          key={report.id} 
                          report={report}
                          onClick={() => onSelectReport(report.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Under Review Reports */}
                {reports.filter(r => r.status === "Under Review").length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <AlertCircle className="w-4 h-4 text-theme-status-review" />
                      <h3 className="text-slate-900">Under Review</h3>
                      <Badge variant="secondary" className="rounded-md ml-auto">
                        {reports.filter(r => r.status === "Under Review").length}
                      </Badge>
                    </div>
                    <div className="space-y-1.5 sm:space-y-2 max-h-[500px] overflow-y-auto">
                      {reports.filter(r => r.status === "Under Review").map((report) => (
                        <ReportCard 
                          key={report.id} 
                          report={report}
                          onClick={() => onSelectReport(report.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Completed Reports */}
                {reports.filter(r => r.status === "Completed").length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="w-4 h-4 text-theme-status-complete" />
                      <h3 className="text-slate-900">Completed</h3>
                      <Badge variant="secondary" className="rounded-md ml-auto">
                        {reports.filter(r => r.status === "Completed").length}
                      </Badge>
                    </div>
                    <div className="space-y-1.5 sm:space-y-2 max-h-[500px] overflow-y-auto">
                      {reports.filter(r => r.status === "Completed").map((report) => (
                        <ReportCard 
                          key={report.id} 
                          report={report}
                          onClick={() => onSelectReport(report.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {reports.length === 0 && (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-600 mb-4">No reports yet</p>
                    <Button 
                      onClick={() => setIsNewReportModalOpen(true)}
                      className="bg-theme-action-primary hover:bg-theme-action-primary-hover text-white rounded-lg"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create First Report
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Photos Tab */}
          <TabsContent value="photos">
            <Card className="rounded-xl shadow-sm border-slate-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle>Project Photos</CardTitle>
                  <CardDescription>Site photos organized by visit</CardDescription>
                </div>
                <Button
                  className="bg-theme-action-primary hover:bg-theme-action-primary-hover text-white rounded-lg"
                  onClick={() => setIsPhotoUploadModalOpen(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Upload Photos
                </Button>
              </CardHeader>
              <CardContent>
                {/* Filter Controls */}
                {photoFolders.length > 0 && (
                  <div className="mb-4 space-y-3">
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                      {/* Keyword Search */}
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          type="text"
                          placeholder="Search photos..."
                          value={photoSearchKeyword}
                          onChange={(e) => setPhotoSearchKeyword(e.target.value)}
                          className="pl-9 h-9 rounded-lg"
                        />
                        {photoSearchKeyword && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                            onClick={() => setPhotoSearchKeyword("")}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>

                      {/* Date Filter */}
                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
                          <Input
                            type="date"
                            value={photoFilterDateStart}
                            onChange={(e) => setPhotoFilterDateStart(e.target.value)}
                            placeholder="Start Date"
                            className="pl-9 h-9 rounded-lg w-full sm:w-[180px]"
                          />
                        </div>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
                          <Input
                            type="date"
                            value={photoFilterDateEnd}
                            onChange={(e) => setPhotoFilterDateEnd(e.target.value)}
                            placeholder="End Date"
                            className="pl-9 h-9 rounded-lg w-full sm:w-[180px]"
                          />
                        </div>
                      </div>

                      {/* User Filter */}
                      <Select value={photoFilterUser} onValueChange={setPhotoFilterUser}>
                        <SelectTrigger className="w-full sm:w-[160px] h-9 rounded-lg">
                          <Filter className="w-4 h-4 mr-2" />
                          <SelectValue placeholder="All Users" />
                        </SelectTrigger>
                        <SelectContent className="rounded-lg">
                          <SelectItem value="all" className="rounded-md">All Users</SelectItem>
                          {availableUsers.map(user => (
                            <SelectItem key={user} value={user} className="rounded-md">
                              {user}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Active Filters Indicator */}
                    {hasActiveFilters && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <span>Showing {filteredPhotos.length} of {totalPhotos} photos</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setPhotoSearchKeyword("");
                            setPhotoFilterDateStart("");
                            setPhotoFilterDateEnd("");
                            setPhotoFilterUser("all");
                          }}
                          className="h-7 text-xs text-theme-primary hover:text-theme-primary-hover"
                        >
                          <X className="w-3 h-3 mr-1" />
                          Clear filters
                        </Button>
                      </div>
                    )}

                    {/* Photo Size Controls */}
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs text-slate-600">Photo Size:</span>
                      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-md"
                          onClick={() => setPhotoGridSize(Math.max(0, photoGridSize - 1))}
                          disabled={photoGridSize === 0}
                        >
                          <span className="text-base">−</span>
                        </Button>
                        <span className="text-xs text-slate-700 px-2 min-w-[40px] text-center">
                          {photoGridSize === 0 && "XS"}
                          {photoGridSize === 1 && "S"}
                          {photoGridSize === 2 && "M"}
                          {photoGridSize === 3 && "L"}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-md"
                          onClick={() => setPhotoGridSize(Math.min(3, photoGridSize + 1))}
                          disabled={photoGridSize === 3}
                        >
                          <span className="text-base">+</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                
                {photoFolders.length > 0 ? (
                  <PhotoFolderView
                    folders={filteredFolders}
                    photos={filteredPhotos}
                    mode="view"
                    onPhotoClick={handlePhotoClick}
                    onDeletePhoto={handleDeletePhoto}
                    onDeleteFolder={handleDeleteFolder}
                    onAudioTimelineClick={handleAudioTimelineClick}
                    gridSize={photoGridSize}
                    onGridSizeChange={setPhotoGridSize}
                  />
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Camera className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-slate-900 mb-2">No Photos Yet</h3>
                    <p className="text-slate-600 mb-4 max-w-md mx-auto">
                      Upload photos organized by site visits to keep your project documentation organized
                    </p>
                    <Button
                      className="bg-theme-action-primary hover:bg-theme-action-primary-hover text-white rounded-lg"
                      onClick={() => setIsPhotoUploadModalOpen(true)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Upload First Photos
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Knowledge Base Tab */}
          <TabsContent value="knowledge">
            <Card className="rounded-xl shadow-sm border-slate-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle>Knowledge Base</CardTitle>
                  <CardDescription>Project-specific documents that AI will reference</CardDescription>
                </div>
                <Button
                  className="bg-theme-action-primary hover:bg-theme-action-primary-hover text-white rounded-lg"
                  onClick={() => setIsKnowledgeUploadModalOpen(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Upload Document
                </Button>
              </CardHeader>
              <CardContent>
                {knowledgeDocuments.length > 0 ? (
                  <div className="space-y-3">
                    {knowledgeDocuments.map((doc) => (
                      <div
                        key={doc.id}
                        className="group flex items-start gap-4 p-4 border-2 border-slate-200 rounded-xl hover:border-theme-hover hover:bg-theme-hover transition-all"
                      >
                        <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0 text-2xl">
                          {getDocumentTypeIcon(doc.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-slate-900 mb-1">{doc.name}</h4>
                          {doc.description && (
                            <p className="text-sm text-slate-600 mb-2">{doc.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            <Badge variant="outline" className="rounded-md">
                              {getDocumentTypeName(doc.type)}
                            </Badge>
                            <span>{doc.fileSize}</span>
                            <span>{doc.fileType}</span>
                            <span>Uploaded {doc.uploadDate}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="rounded-lg h-9 w-9"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="rounded-lg h-9 w-9 hover:bg-theme-action-destructive-light hover:border-theme-action-destructive"
                            onClick={() => handleDeleteKnowledge(doc.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <BookOpen className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-slate-900 mb-2">No Knowledge Documents Yet</h3>
                    <p className="text-slate-600 mb-4 max-w-md mx-auto">
                      Upload specifications, standards, and guidelines that AI will use when generating and editing reports
                    </p>
                    <Button
                      className="bg-theme-action-primary hover:bg-theme-action-primary-hover text-white rounded-lg"
                      onClick={() => setIsKnowledgeUploadModalOpen(true)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Upload First Document
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <NewReportModal
        open={isNewReportModalOpen}
        onOpenChange={setIsNewReportModalOpen}
        projectName={project.name}
        onCreateReport={handleCreateReport}
      />

      <PhotoDetailModal
        open={isPhotoModalOpen}
        onOpenChange={setIsPhotoModalOpen}
        photo={selectedPhoto}
        onSaveDescription={handleSavePhotoDescription}
        onNavigate={handlePhotoNavigate}
        canNavigate={getNavigationState()}
      />

      <KnowledgeUploadModal
        open={isKnowledgeUploadModalOpen}
        onOpenChange={setIsKnowledgeUploadModalOpen}
        onUpload={handleUploadKnowledge}
      />

      <PhotoUploadModal
        open={isPhotoUploadModalOpen}
        onOpenChange={setIsPhotoUploadModalOpen}
        existingFolders={photoFolders}
        onUpload={handleUploadPhotos}
      />
    </div>
  );
}
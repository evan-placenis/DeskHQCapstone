import { useState } from "react";
import { AppHeader } from "./AppHeader";
import { Page } from "../App";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import {
  Upload,
  Search,
  Filter,
  Grid3x3,
  List,
  Download,
  Trash2,
  Tag,
  Link as LinkIcon,
  Calendar,
  MapPin,
} from "lucide-react";

interface PhotoOrganizerPageProps {
  onNavigate: (page: Page) => void;
  onLogout: () => void;
}

const mockPhotos = [
  {
    id: 1,
    url: "https://images.unsplash.com/photo-1599995903128-531fc7fb694b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjBzaXRlfGVufDF8fHx8MTc2Mjg2NTEwNnww&ixlib=rb-4.1.0&q=80&w=1080",
    name: "foundation-overview-01.jpg",
    date: "2025-11-10",
    location: "Route 95, Section A",
    tags: ["foundation", "overview"],
    linkedReport: "Foundation Assessment",
    size: "2.4 MB",
  },
  {
    id: 2,
    url: "https://images.unsplash.com/photo-1691947563165-28011f40d786?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidWlsZGluZyUyMGluZnJhc3RydWN0dXJlfGVufDF8fHx8MTc2Mjg5NTU4Mnww&ixlib=rb-4.1.0&q=80&w=1080",
    name: "structural-support-02.jpg",
    date: "2025-11-10",
    location: "Route 95, Section A",
    tags: ["structural", "support"],
    linkedReport: "Foundation Assessment",
    size: "3.1 MB",
  },
  {
    id: 3,
    url: "https://images.unsplash.com/photo-1645258044234-f4ba2655baf1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbmdpbmVlcmluZyUyMGVxdWlwbWVudHxlbnwxfHx8fDE3NjI4OTU1ODJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    name: "equipment-check-03.jpg",
    date: "2025-11-09",
    location: "Route 95, Section B",
    tags: ["equipment", "safety"],
    linkedReport: null,
    size: "1.8 MB",
  },
  {
    id: 4,
    url: "https://images.unsplash.com/photo-1738528575208-b9ccdca8acaf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmR1c3RyaWFsJTIwc2l0ZXxlbnwxfHx8fDE3NjI4OTU1ODJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    name: "site-overview-04.jpg",
    date: "2025-11-09",
    location: "Route 95, Section B",
    tags: ["overview", "site"],
    linkedReport: null,
    size: "2.9 MB",
  },
  {
    id: 5,
    url: "https://images.unsplash.com/photo-1599995903128-531fc7fb694b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb25zdHJ1Y3Rpb24lMjBzaXRlfGVufDF8fHx8MTc2Mjg2NTEwNnww&ixlib=rb-4.1.0&q=80&w=1080",
    name: "concrete-detail-05.jpg",
    date: "2025-11-08",
    location: "Route 95, Section A",
    tags: ["concrete", "quality"],
    linkedReport: "Concrete Quality Report",
    size: "2.2 MB",
  },
  {
    id: 6,
    url: "https://images.unsplash.com/photo-1691947563165-28011f40d786?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidWlsZGluZyUyMGluZnJhc3RydWN0dXJlfGVufDF8fHx8MTc2Mjg5NTU4Mnww&ixlib=rb-4.1.0&q=80&w=1080",
    name: "infrastructure-06.jpg",
    date: "2025-11-08",
    location: "Route 95, Section C",
    tags: ["infrastructure"],
    linkedReport: null,
    size: "3.5 MB",
  },
];

export function PhotoOrganizerPage({ onNavigate, onLogout }: PhotoOrganizerPageProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedPhotos, setSelectedPhotos] = useState<number[]>([]);

  const togglePhotoSelection = (id: number) => {
    setSelectedPhotos((prev) =>
      prev.includes(id) ? prev.filter((photoId) => photoId !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader currentPage="photos" onNavigate={onNavigate} onLogout={onLogout} />

      <main className="container mx-auto px-6 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-slate-900 mb-1">Photo Organizer</h1>
              <p className="text-slate-600">Manage and organize your site photos</p>
            </div>
            <Button className="bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md">
              <Upload className="w-4 h-4 mr-2" />
              Upload Photos
            </Button>
          </div>

          {/* Filters & Search */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[300px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search photos by name, tags, or location..."
                className="pl-10 rounded-lg"
              />
            </div>

            <Select defaultValue="all">
              <SelectTrigger className="w-[180px] rounded-lg">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Photos</SelectItem>
                <SelectItem value="linked">Linked to Reports</SelectItem>
                <SelectItem value="unlinked">Unlinked</SelectItem>
                <SelectItem value="recent">Recently Added</SelectItem>
              </SelectContent>
            </Select>

            <Select defaultValue="newest">
              <SelectTrigger className="w-[150px] rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="name">Name A-Z</SelectItem>
                <SelectItem value="size">Size</SelectItem>
              </SelectContent>
            </Select>

            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "grid" | "list")}>
              <TabsList className="rounded-lg">
                <TabsTrigger value="grid" className="rounded-md">
                  <Grid3x3 className="w-4 h-4" />
                </TabsTrigger>
                <TabsTrigger value="list" className="rounded-md">
                  <List className="w-4 h-4" />
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Selected Actions */}
        {selectedPhotos.length > 0 && (
          <Card className="p-4 mb-6 rounded-xl border-slate-200 bg-blue-50">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-900">
                {selectedPhotos.length} photo{selectedPhotos.length > 1 ? "s" : ""} selected
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="rounded-lg">
                  <Tag className="w-4 h-4 mr-2" />
                  Add Tags
                </Button>
                <Button variant="outline" size="sm" className="rounded-lg">
                  <LinkIcon className="w-4 h-4 mr-2" />
                  Link to Report
                </Button>
                <Button variant="outline" size="sm" className="rounded-lg">
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <Button variant="outline" size="sm" className="rounded-lg text-red-600 hover:text-red-700">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Photo Grid */}
        {viewMode === "grid" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockPhotos.map((photo) => (
              <Card
                key={photo.id}
                className={`rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                  selectedPhotos.includes(photo.id)
                    ? "border-blue-600 shadow-md"
                    : "border-slate-200 hover:border-slate-300"
                }`}
                onClick={() => togglePhotoSelection(photo.id)}
              >
                <div className="relative aspect-video">
                  <ImageWithFallback
                    src={photo.url}
                    alt={photo.name}
                    className="w-full h-full object-cover"
                  />
                  {selectedPhotos.includes(photo.id) && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h4 className="text-slate-900 text-sm mb-2 truncate">{photo.name}</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Calendar className="w-3 h-3" />
                      {photo.date}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <MapPin className="w-3 h-3" />
                      {photo.location}
                    </div>
                    {photo.linkedReport && (
                      <div className="flex items-center gap-2 text-xs">
                        <LinkIcon className="w-3 h-3 text-blue-600" />
                        <span className="text-blue-600">{photo.linkedReport}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {photo.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs rounded-md">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Photo List */}
        {viewMode === "list" && (
          <div className="space-y-2">
            {mockPhotos.map((photo) => (
              <Card
                key={photo.id}
                className={`rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                  selectedPhotos.includes(photo.id)
                    ? "border-blue-600 shadow-md"
                    : "border-slate-200 hover:border-slate-300"
                }`}
                onClick={() => togglePhotoSelection(photo.id)}
              >
                <div className="flex items-center gap-4 p-4">
                  <div className="relative w-24 h-24 flex-shrink-0">
                    <ImageWithFallback
                      src={photo.url}
                      alt={photo.name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-slate-900 mb-1">{photo.name}</h4>
                    <div className="flex items-center gap-4 text-sm text-slate-600 mb-2">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {photo.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {photo.location}
                      </span>
                      <span>{photo.size}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {photo.linkedReport && (
                        <Badge variant="outline" className="rounded-md">
                          <LinkIcon className="w-3 h-3 mr-1" />
                          {photo.linkedReport}
                        </Badge>
                      )}
                      {photo.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs rounded-md">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {selectedPhotos.includes(photo.id) && (
                    <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

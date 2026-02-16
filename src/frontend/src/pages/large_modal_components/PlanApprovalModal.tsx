import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui_components/dialog';
import { Button } from '../ui_components/button';
import { Label } from '../ui_components/label';
import { Badge } from '../ui_components/badge';
import { ReportPlan } from '@/app/shared/types/report-schemas';
import { 
  ReportStructureEditor, 
  convertSectionToEditorFormat,
  convertEditorFormatToSection 
} from '../smart_components/ReportStructureEditor';
import { Photo } from '@/frontend/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui_components/tabs';
import { SecureImage } from '../smart_components/SecureImage';

interface PlanApprovalModalProps {
  open: boolean;
  onClose: () => void;
  reportPlan: ReportPlan | null;
  reportId: string;
  onApprove: () => void;
  onReject: (feedback: string) => void;
  photos: Photo[];
}

export default function PlanApprovalModal({
  open,
  onClose,
  reportPlan,
  reportId,
  onApprove,
  onReject,
  photos,
}: PlanApprovalModalProps) {
  // --- 1. HOOKS MUST BE AT THE TOP ---
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sections, setSections] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'preview' | 'edit'>('preview');
  const [additionalInstructions, setAdditionalInstructions] = useState('');

  useEffect(() => {
    if (reportPlan?.sections) {
      const sortedSections = [...reportPlan.sections].sort((a, b) => {
        return (a.reportOrder ?? 99) - (b.reportOrder ?? 99);
      });
      const convertedSections = sortedSections.flatMap(convertSectionToEditorFormat);
      setSections(convertedSections);
    }
  }, [reportPlan]);

  

  const selectedPhotoIds = useMemo(() => {
    if (!sections || sections.length === 0) return [];
    const allIds = sections.flatMap(section => section.photoIds || []);
    return Array.from(new Set(allIds)).map(String);
  }, [sections]);

  const syncPreviewSections = useMemo(() => {
    const parents = sections.filter(s => !s.isSubsection);
    return parents.map(parent => ({
      ...parent,
      subsections: sections.filter(s => 
        s.isSubsection && 
        Math.floor(s.reportOrder) === Math.floor(parent.reportOrder)
      )
    })).sort((a, b) => a.reportOrder - b.reportOrder);
  }, [sections]);

  // --- 2. EARLY RETURN AFTER HOOKS ---
  if (!reportPlan) return null;

  // --- 3. HELPER FUNCTIONS ---
  const renderPhotoGrid = (assignedIds: string[]) => {
    if (!assignedIds || assignedIds.length === 0) return null;
    const currentPhotos = (photos || []).filter(p => assignedIds.includes(String(p.id)));
    if (currentPhotos.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-2 mt-3">
        {currentPhotos.slice(0, 8).map((photo) => (
          <div key={photo.id} className="relative w-16 h-16 rounded-md overflow-hidden border border-slate-200 shadow-sm group">
            <SecureImage
              src={photo.url}
              storagePath={photo.storagePath}
              alt={photo.name}
              className="w-full h-full object-cover transition-transform group-hover:scale-110"
            />
          </div>
        ))}
        {currentPhotos.length > 8 && (
          <div className="w-16 h-16 rounded-md border border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-500 bg-slate-50">
            +{currentPhotos.length - 8}
          </div>
        )}
      </div>
    );
  };

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      const updatedPlan = {
        ...reportPlan,
        sections: sections.map(convertEditorFormatToSection),
      };
      const response = await fetch(`/api/report/${reportId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvalStatus: 'APPROVED',
          userFeedback: additionalInstructions || '',
          modifiedPlan: updatedPlan,
        }),
      });
      if (!response.ok) throw new Error(`Failed to approve: ${response.statusText}`);
      onApprove();
      onClose();
    } catch (error) {
      console.error('Failed to approve plan:', error);
      alert('Failed to approve plan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegenerate = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/report/${reportId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvalStatus: 'REJECTED',
          userFeedback: 'User requested AI to regenerate the plan.',
        }),
      });
      if (!response.ok) throw new Error(`Failed to reject: ${response.statusText}`);
      onReject('Regeneration requested');
      onClose();
    } catch (error) {
      console.error('Failed to reject plan:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      {/* 🛠️ MODAL SIZE FIX: style override to force 90vw width */}
      <DialogContent 
        className="max-w-[90vw] w-[90vw] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-xl"
        style={{ width: '90vw', maxWidth: '90vw' }}
      >
        <DialogHeader className="p-6 border-b bg-white z-10 shrink-0">
          <DialogTitle className="text-xl font-semibold text-slate-900">Review Report Plan</DialogTitle>
          <p className="text-sm text-slate-500 mt-1">
            The Architect has analyzed {selectedPhotoIds?.length || 0} photos and proposed this structure.
          </p>
        </DialogHeader>

        <div className="flex-1 min-h-0 bg-slate-50 overflow-hidden">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'preview' | 'edit')} className="h-full flex flex-col">
            {/* 🛠️ CENTERED TOGGLE FIX: added flex justify-center */}
            <div className="px-6 pt-4 flex justify-center w-full">
              <TabsList className="grid w-[400px] grid-cols-2 bg-slate-200/50">
                <TabsTrigger 
                  value="preview"
                  className="data-[state=active]:bg-white data-[state=active]:text-[#3c6e71] data-[state=active]:shadow-sm"
                >
                  👁️ Visual Preview
                </TabsTrigger>
                <TabsTrigger 
                  value="edit"
                  className="data-[state=active]:bg-white data-[state=active]:text-[#3c6e71] data-[state=active]:shadow-sm"
                >
                  ✏️ Edit Structure
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="preview" className="flex-1 overflow-y-auto p-6 space-y-6">
              {reportPlan.strategy && (
                <div className="bg-[#3c6e71]/5 border border-[#3c6e71]/20 rounded-lg p-4 mb-6">
                  <Label className="text-xs font-bold text-[#3c6e71] uppercase tracking-wide mb-2 block">
                    Architect's Strategy
                  </Label>
                  <p className="text-sm text-slate-700 leading-relaxed">{reportPlan.strategy}</p>
                </div>
              )}

              <div className="space-y-4 max-w-5xl mx-auto">
                {syncPreviewSections.map((section, index) => (
                  <div key={section.id || index} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-600 text-xs font-bold">
                          {Math.floor(section.reportOrder)}
                        </span>
                        <h3 className="font-semibold text-lg text-slate-800">{section.title}</h3>
                      </div>
                      
                      <Badge variant="secondary" className="bg-white border text-[#3c6e71] border-[#3c6e71]/20">
                        {section.photoIds?.length || 0} Photos
                      </Badge>
                    </div>

                    <div className="p-4">
                      {renderPhotoGrid(section.photoIds || [])}

                      {section.subsections && section.subsections.length > 0 && (
                        <div className="mt-4 space-y-3 pl-4 border-l-2 border-slate-100 ml-2">
                          {section.subsections.map((sub: any, subIndex: number) => (
                            <div key={sub.id || subIndex} className="bg-slate-50 rounded-lg p-3">
                              <div className="flex justify-between items-start">
                                <h4 className="font-medium text-slate-700">{sub.title}</h4>
                                <Badge className="bg-white text-[#3c6e71] border border-[#3c6e71]/20 text-[10px] h-5">
                                  {sub.photoIds?.length || 0} img
                                </Badge>
                              </div>
                              {renderPhotoGrid(sub.photoIds || [])}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="edit" className="flex-1 overflow-hidden">
               <div className="p-6 h-full overflow-y-auto">
                  <ReportStructureEditor
                    sections={sections}
                    onSectionsChange={setSections}
                    photos={photos} 
                    selectedPhotoIds={selectedPhotoIds} 
                    showPhotoLibrary={true}
                    readOnly={false}
                    additionalInstructions={additionalInstructions}
                    onAdditionalInstructionsChange={setAdditionalInstructions}
                    showAdditionalInstructions={true}
                  />
               </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="p-4 border-t bg-white flex justify-between items-center z-10 shrink-0">
          <Button variant="ghost" onClick={handleRegenerate} disabled={isSubmitting} className="text-slate-500 hover:text-red-600">
             Show me a different plan
          </Button>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button 
              onClick={handleApprove} 
              disabled={isSubmitting} 
              className="bg-[#3c6e71] hover:bg-[#2d5456] text-white min-w-[140px]"
            >
              {isSubmitting ? 'Approving...' : 'Looks Good! →'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
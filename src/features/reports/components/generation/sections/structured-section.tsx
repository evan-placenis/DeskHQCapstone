"use client";

import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { SecureImage } from "@/components/ui/secure-image";
import { EditableText } from "../../presentation/legacy-text/editable-text";
import type { ReportSection } from "@/lib/types";

export function StructuredSection({
  section,
  sectionPrefix,
  handleUpdateNestedContent,
}: {
  section: ReportSection;
  sectionPrefix: string;
  handleUpdateNestedContent: (
    sectionId: string | number,
    subSectionIndex: number,
    pointIndex: number | null,
    newValue: string,
  ) => void;
}) {
  let globalPointCounter = 1;

  return (
    <div>
      {section.description && (
        <div className="mb-6">
          <EditableText
            value={section.description}
            onChange={(val) => handleUpdateNestedContent(section.id, -1, null, val)}
            multiline
            markdown={true}
            className="text-slate-600"
          />
        </div>
      )}

      {section.subSections!.map((sub, subIdx) => (
        <div key={subIdx} className="mb-6">
          {sub.title !== "General Summary" && sub.title !== "Observed Conditions" && (
            <h4 className="text-lg font-medium text-slate-800 mb-2">{sub.title}</h4>
          )}

          {sub.description && (
            <div className="mb-4">
              <EditableText
                value={sub.description}
                onChange={(val) => handleUpdateNestedContent(section.id, subIdx, null, val)}
                multiline
                markdown={true}
                className="text-slate-600"
              />
            </div>
          )}

          <div className="space-y-3 mt-2">
            {sub.children.map((point, pIdx) => {
              const pointHasImages = point.images && point.images.length > 0;
              const pointLabel = `${sectionPrefix}.${globalPointCounter++}`;

              return (
                <div
                  key={pIdx}
                  className={`grid grid-cols-1 ${pointHasImages ? "md:grid-cols-2 gap-6" : "gap-4"}`}
                >
                  <div className="flex gap-3">
                    <span className="mt-1 text-slate-900 font-normal min-w-[2rem] select-none">{pointLabel}</span>
                    <div className="flex-1">
                      <EditableText
                        value={point.point}
                        onChange={(val) => handleUpdateNestedContent(section.id, subIdx, pIdx, val)}
                        multiline
                        markdown={true}
                        className="w-full"
                      />
                    </div>
                  </div>

                  {pointHasImages && (
                    <div className="space-y-4">
                      {point.images!.map(
                        (img: {
                          imageId?: string;
                          id?: string;
                          storagePath?: string;
                          url?: string;
                          description?: string;
                          caption?: string;
                        }) => (
                          <div
                            key={img.imageId || img.id || Math.random()}
                            className="rounded-lg overflow-hidden border border-slate-200 shadow-sm bg-white"
                          >
                            {img.storagePath ? (
                              <SecureImage
                                storagePath={img.storagePath}
                                alt={img.description || img.caption || "Report Image"}
                                className="w-full h-48 object-cover"
                              />
                            ) : (
                              <ImageWithFallback
                                src={img.url}
                                alt={img.description || img.caption || "Report Image"}
                                className="w-full h-48 object-cover"
                              />
                            )}
                            {(img.description || img.caption) && (
                              <div className="p-2 border-t border-slate-200 bg-slate-50">
                                <p className="text-xs text-slate-600 line-clamp-2">
                                  {img.description || img.caption}
                                </p>
                              </div>
                            )}
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

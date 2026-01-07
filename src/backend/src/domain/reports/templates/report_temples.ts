// src/domain/templates/strategies.ts
export type ReportBlueprint = {
    _review_reasoning: string;
    reportTitle: string;
    reportContent: SectionBlueprint[]; // Instructions for the Writer Agent
};
export type SectionBlueprint = {
    _reasoning: string,
    title: string;
    description: string; // Instructions for the Writer Agent
    required: boolean;
    images: string[];
    order: number;
    isReviewRequired: boolean;
    children: bulletpointBlueprint[];
};
export type bulletpointBlueprint = {
    point: string;
    children: bulletpointBlueprint[];
};


export const ObservationReportTemplate: ReportBlueprint[] = [
    {_review_reasoning: "",
    reportTitle: "",
    reportContent: [
        { 
        _reasoning: "",
        title: "1.0 Executive Summary", 
        description: "",
        images: [],
        order: 1,
        isReviewRequired: true,
        children: [{point:"", children: []}, {point:"", children: []}, {point:"", children: []}],
        required: true 
        },
        { 
        _reasoning: "",
        title: "2.0 Site Conditions", 
        description: "Detail specific defects found. Focus on cracks and water damage.",
        images: [],
        order: 2,
        isReviewRequired: true,
        children: [{point:"", children: []}, {point:"", children: []}, {point:"", children: []}],
        required: true 
        },
        { 
        _reasoning: "",
        title: "3.0 Observations", 
        description: "Provide bullet points on immediate next steps.",
        images: [],
        order: 3,
        isReviewRequired: true,
        children: [{point:"", children: []}, {point:"", children: []}, {point:"", children: []}],
        required: true 
        },
        { 
        _reasoning: "",
        title: "4.0 Recommendations", 
        description: "Provide bullet points on immediate next steps.",
        images: [],
        order: 4,
        isReviewRequired: true,
        children: [{point:"", children: []}, {point:"", children: []}, {point:"", children: []}],
        required: true 
        },
    ]
}];
// src/domain/templates/strategies.ts
export type ReportBlueprint = {
    _review_reasoning: string;
    reportTitle: string;
    isReviewRequired: boolean;
    reportContent: MainSectionBlueprint[];
};
// export type MainSectionBlueprint = {
//     _reasoning: string,
//     title: string;
//     description: string; 
//     required: boolean;
//     order: number;
//     children: SubSectionBlueprint[];
// };

// export type MainSectionBlueprint = {
//     _reasoning: string,
//     title: string;
//     description: string; 
//     required: boolean;
//     order: number;
//     children: SubSectionBlueprint[];
//     images?: string[]; // Added optional images array for compatibility
// };
// export type SubSectionBlueprint = {
//     _reasoning: string,
//     title: string;
//     description: string; 
//     required: boolean;
//     order: number;
//     children: bulletpointBlueprint[];
// };
// export type bulletpointBlueprint = {
//     point: string;
//     images: string[];
// };

import { MainSectionBlueprint } from "../report.types";
export const ObservationReportTemplate: ReportBlueprint[] = [
    {
        _review_reasoning: "",
        reportTitle: "Observation Report",
        isReviewRequired: true,
        reportContent: [
            // --- 1.0 Executive Summary ---
            {
                _reasoning: "",
                title: "1.0 Executive Summary",
                description: "",
                required: true,
                order: 1,
                // Main Section children must be SubSections
                children: [
                    {
                        _reasoning: "",
                        title: "General Summary",
                        description: "",
                        required: true,
                        order: 1,
                        // SubSection children must be BulletPoints
                        children: [
                            { point: "Summary point 1", images: [] },
                            { point: "Summary point 2", images: [] },
                            { point: "Summary point 3", images: [] }
                        ]
                    }
                ]
            },

            // --- 2.0 Site Conditions ---
            {
                _reasoning: "",
                title: "2.0 Site Conditions",
                description: "",
                required: true,
                order: 2,
                // We must wrap the points in a SubSection to satisfy the Type definition
                children: [
                    {
                        _reasoning: "",
                        title: "Observed Conditions",
                        description: "",
                        required: true,
                        order: 1,
                        children: [
                            { point: "Condition 1", images: [] },
                            { point: "Condition 2", images: [] },
                            { point: "Condition 3", images: [] }
                        ]
                    }
                ]
            },

            // --- 3.0 Observations ---
            {
                _reasoning: "",
                title: "3.0 Observations",
                description: "",
                required: true,
                order: 3,
                children: [
                    {
                        _reasoning: "",
                        title: "Key Observations",
                        description: "",
                        required: true,
                        order: 1,
                        children: [
                            { point: "Observation 1", images: [] },
                            { point: "Observation 2", images: [] },
                            { point: "Observation 3", images: [] }
                        ]
                    }
                ]
            },

            // --- 4.0 Recommendations ---
            {
                _reasoning: "",
                title: "4.0 Recommendations",
                description: "Provide bullet points on immediate next steps.",
                required: true,
                order: 4,
                children: [
                    {
                        _reasoning: "",
                        title: "Action Items",
                        description: "",
                        required: true,
                        order: 1,
                        children: [
                            { point: "Recommendation 1", images: [] },
                            { point: "Recommendation 2", images: [] },
                            { point: "Recommendation 3", images: [] }
                        ]
                    }
                ]
            }
        ]
    }];
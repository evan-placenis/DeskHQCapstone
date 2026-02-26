import { SystemMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { ModelStrategy } from "../../../models/modelStrategy";
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { Container } from "@/backend/config/container";
import { ObservationState } from "../../../state/report/ObservationState";
import { dumpAgentContext } from "../../../utils/agent-logger";

/**
 * Phase 1: The Architect
 * * Analyzes inputs (photos, notes, instructions) and proposes a Report Plan.
 * Does NOT write content yet - just organizes structure.
 */
export async function architectNode(state: typeof ObservationState.State) {
  const { 
    imageList,            // ✅ NEW: Pre-fetched rich data
    systemPrompt,
    structureInstructions, 
    provider, 
    reportPlan: inputPlan, // <--- Rename to avoid confusion
    userFeedback,
    draftReportId,
    client
  } = state;


  // Define a tool for the architect to output the plan in structured format
  const planningTool = tool(
    async ({ sections, strategy }) => {
      console.log(`📐 Architect: Plan created with ${sections.length} sections`);
      return {
        status: 'SUCCESS',
        message: 'Report plan created. Awaiting approval.',
        sections,
        strategy
      };
    },
    {
      name: 'submitReportPlan',
      description: 'Submit the proposed report structure and strategy. Include all sections with their assigned photo IDs.',
      schema: z.object({
        reasoning: z.string().describe('Explain WHY you grouped photos this way.'),
        sections: z.array(z.object({
          sectionId: z.string().describe('Unique ID for section (e.g., "exec-summary", "observations")'),
          title: z.string().describe('Section title (e.g., "Executive Summary", "Observations")'),
          reportOrder: z.number().describe('The position this section should appear in the FINAL report (e.g. Executive Summary = 1, Recommendations = 2, Observations = 3)'),
          purpose: z.string().optional().describe('Why this section exists'),

          // ✅ The "Tuple" Strategy: Maps specific IDs to this section
          // The Builder will use these IDs to look up the full details in 'imageList'
          assignedImageIds: z.array(z.string()).describe('List of Photo IDs assigned to this section. MUST correspond to the [ID: ...] provided in context.'),
          
          // Optional: Nested subsections
          subsections: z.array(z.object({
            subSectionId: z.string(),
            title: z.string(),
            assignedImageIds: z.array(z.string()).optional(),
            purpose: z.string().optional()
          })).optional().describe('Breakdown of this section into specific areas')
        })).describe('List of sections in the report'),
        strategy: z.string().describe('Overall approach and reasoning for this structure'),
      }), 
    }
  );

  // 1. GENERATE CONTEXT STRING
  // We use the "Compressed Manifest" pattern: Metadata only, no 2000-token descriptions.
  const photoContext = imageList && imageList.length > 0 
    ? imageList.map((img, index) => {
        // Build a concise summary line
        const tags = img.tags && img.tags.length > 0 ? `[Tags: ${img.tags.join(', ')}]` : '';
        const note = img.userNote ? ` | User Note: "${img.userNote}"` : '';
        const severity = img.severity ? ` | Severity: ${img.severity}` : '';
        
        return `[ID: ${img.id}] Photo ${index + 1}: ${tags}${severity}${note}`;
      }).join('\n')
    : "No photos selected.";

 
  // 2. CONSTRUCT PROMPT
  const promptContext = `${systemPrompt}

---
ARCHITECT PHASE: PLANNING
---
Your current role is to PLAN the report structure to get initial feedback from the user. You are NOT writing content yet.

INPUTS:
- Structure Requirements: ${structureInstructions} 
- Photo Count: ${imageList?.length || 0}

AVAILABLE EVIDENCE (Use these [ID: ...] UUIDs strictly):
${photoContext}

${userFeedback ? `!!! ATTENTION: PLAN REVISION !!!
  The user REJECTED your previous plan.
  USER FEEDBACK: "${userFeedback}"
  
  HERE IS YOUR PREVIOUS PLAN (The one that was rejected):
  \`\`\`json
  ${JSON.stringify(inputPlan, null, 2)}
  \`\`\`
  
  INSTRUCTIONS FOR REVISION:
  1. Keep the parts of the plan that work.
  2. ONLY change the sections mentioned in the feedback.
  3. Submit the FULL revised plan (all sections) again.
  ` : ''} 

YOUR TASK:
1. Analyze the evidence (Tags, Severity, User Notes).
2. Group related photos into logical high level sections (e.g., "Roofing", "Insulation").
3. Propose a logical structure using the 'submitReportPlan' tool.
4. Use the 'submitReportPlan' tool to output your plan in structured format.

GUIDELINES:
1. **Execution Order (The Array):** You MUST output the 'sections' array in the order we should WRITE them.
   - Start with Data/Observations (so we have facts).
   - End with Summaries (so we can summarize the facts).

2. **Report Order (The Field):** For each section, assign the correct 'reportOrder' number for the Final PDF.
   - Executive Summary should be 'reportOrder: 1'.
   - Observations should be 'reportOrder: 2'.
   - Recommendations should be 'reportOrder: 3'.

   3. **Exclusive Photo Assignment:** - Photos must be assigned to the LOWEST possible level. 
   - If a section has subsections, the assignedImageIds for the PARENT section MUST be an empty array [].
   - Do not "duplicate" photo IDs in both the parent and the subsection. This causes repetitive content generation.

OUTPUT: Call 'submitReportPlan' with your proposed structure.

{
    "reasoning": "...",
    "sections": [
      { 
        "sectionId": "obs-roof", 
        "title": "Roof Observations", 
        "reportOrder": 2,
        "purpose": "To document membrane deficiencies",
        "assignedImageIds": [ "aa54020a-...","bb12345b-..."]
      },
      {
        "sectionId": "exec-summary",
        "title": "Executive Summary",
        "reportOrder": 1,
        "photoContext": []
      }
    ]
  }

`;

  // 3. RUN MODEL
  const baseModel = ModelStrategy.getModel(provider || 'gemini-cheap');
  
  // 📝 Log the INPUT (The prompt + any RAG history it is carrying)
  const taskName = `Architect_Plan_1`;
  dumpAgentContext(draftReportId || "", taskName, [new SystemMessage(promptContext), ...state.messages], 'INPUT');

  const model = baseModel?.bindTools?.([planningTool], {
    tool_choice: "submitReportPlan" 
  });



  const response = await model?.invoke?.([
    new SystemMessage(promptContext),
    ...state.messages
  ]);

  // 📝 Log the OUTPUT (What the AI just generated / The tools it wants to call)
  dumpAgentContext(draftReportId || "", taskName, [response], 'OUTPUT');

  // 4. PARSE TOOL CALL
  let reportPlan = null;
  let toolResultMsg = null;
  const aiMsg = response as AIMessage;
  
  if (aiMsg.tool_calls && aiMsg.tool_calls.length > 0) {
    const call = aiMsg.tool_calls[0];

    toolResultMsg = new ToolMessage({
      tool_call_id: call.id || '', 
      name: call.name,
      content: "Plan generated and saved successfully. Ready for approval."
    });

    if (call.name === 'submitReportPlan') {
      reportPlan = {
        sections: call.args.sections,
        strategy: call.args.strategy,
        reasoning: call.args.reasoning
      };
    }
  }

  // 5. UPDATE DB (For UI Feedback)
  if (draftReportId && client) {
    try {
      await Container.reportService.updateReportStatus(draftReportId, {
        plan: reportPlan,          
        status: 'AWAITING_APPROVAL' 
      }, client);
      console.log('✅ Architect: Report plan saved to database');
    } catch (error) {
      console.error('❌ Architect: Failed to save report plan:', error);
    }
  }

  return {
    messages: toolResultMsg ? [response, toolResultMsg] : [response], 
    reportPlan,
    approvalStatus: 'PENDING',
    next_step: 'human_approval'
  };
}

// import { SystemMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
// import { ModelStrategy } from "../../../models/modelStrategy";
// import { tool } from '@langchain/core/tools';
// import { z } from 'zod';
// import { Container } from "@/backend/config/container";
// /**
//  * Phase 1: The Architect
//  * 
//  * Analyzes inputs (photos, notes, instructions) and proposes a Report Plan.
//  * Does NOT write content yet - just organizes structure.
//  */
// export async function architectNode(state: any) {
//   const { 
//     selectedImageIds, 
//     photoNotes, 
//     systemPrompt,
//     structureInstructions, 
//     provider, 
//     reportPlan: existingPlan,
//     userFeedback,
//     context,
//     draftReportId,
//     client
//   } = state;

//   // Define a tool for the architect to output the plan in structured format
//   const planningTool = tool(
//     async ({ sections, strategy }) => {
//       console.log(`📐 Architect: Plan created with ${sections.length} sections`);
//       return {
//         status: 'SUCCESS',
//         message: 'Report plan created. Awaiting approval.',
//         sections,
//         strategy
//       };
//     },
//     {
//       name: 'submitReportPlan',
//       description: 'Submit the proposed report structure and strategy. Include all sections with their assigned photo IDs.',
//       schema: z.object({
//         reasoning: z.string().describe('Explain WHY you grouped photos this way.'),
//         sections: z.array(z.object({
//           sectionId: z.string().describe('Unique ID for section (e.g., "exec-summary", "observations")'),
//           title: z.string().describe('Section title (e.g., "Executive Summary", "Observations")'),
//           reportOrder: z.number().describe('The position this section should appear in the FINAL report (e.g. Executive Summary = 1, Recommendations = 2, Observations = 3)'),
//           purpose: z.string().optional().describe('Why this section exists'),

//           // // 1. Parent Photos (Optional)
//           // assignedPhotoIds: z.array(z.string()).optional().describe('Photo IDs assigned to the main section (usually empty if using subsections)'),
//           // // ✅ NEW FIELD: The "Tuple" Strategy
//           photoContext: z.array(z.object({
//             photoId: z.string().describe('The UUID of the photo'),
//             note: z.string().describe('The specific human note for this photo (if any)')
//          })).optional().describe('Map specific notes to photos for this section'),

//           // 2. NEW: Subsections (The Nested Structure)
//           subsections: z.array(z.object({
//             subSectionId: z.string().describe('Unique ID (e.g., "obs-roof", "obs-walls")'),
//             title: z.string().describe('Subsection title (e.g., "Roofing System", "Exterior Walls")'),
//             // assignedPhotoIds: z.array(z.string()).describe('Photo IDs specific to this subsection'),
//             photoContext: z.array(z.object({
//               photoId: z.string(),
//               note: z.string()
//            })).optional(),
//             purpose: z.string().optional()
//           })).optional().describe('Breakdown of this section into specific areas (e.g. Observations -> Roof, Walls, Foundation)')
//         })).describe('List of sections in the report'),
//         strategy: z.string().describe('Overall approach and reasoning for this structure'),
//       }), 
//     }
//   );

//     // FETCH PHOTOS FROM DB — `photos` is not in LangGraph state, so we query directly
//   let selectedImages: any[] = [];
//   if (client && selectedImageIds && selectedImageIds.length > 0) {
//     try {
//       const { data, error } = await client
//         .from('project_images')
//         .select('*')
//         .in('id', selectedImageIds);
//       if (error) {
//         console.error('❌ Architect: Failed to fetch photos:', error);
//       } else {
//         selectedImages = data || [];
//         console.log(`📷 Architect: Fetched ${selectedImages.length} photos from DB`);
//       }
//     } catch (err) {
//       console.error('❌ Architect: Exception fetching photos:', err);
//     }
//   }

//   // Parse photoNotes into a per-photo lookup if it's a JSON map, otherwise ignore
//   let photoNotesMap: Record<string, string> = {};
//   if (photoNotes) {
//     try {
//       const parsed = JSON.parse(photoNotes);
//       if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
//         photoNotesMap = parsed;
//       }
//     } catch {
//       // photoNotes is plain text — not a JSON map, ignore it
//     }
//   }

//   const photoContext = selectedImages.map((img: any, index: number) => {
//     // 🛡️ Safe extraction of text — DB columns: description, ai_description, user_note, file_name
//     const desc = img.description || img.ai_description || img.file_name || "No description";
//     const note = photoNotesMap[img.id] || img.user_note || "";
    
//     // 🔑 PUT THE UUID IN BRACKETS so the AI can copy it exactly
//     return `[ID: ${img.id}] Photo ${index + 1}: ${desc}${note ? ` | User Note: "${note}"` : ''}`;
// }).join('\n');

 
//   // 👇 PROMPT CONSTRUCTION
//   const promptContext = `${systemPrompt}

// ---
// ARCHITECT PHASE: PLANNING
// ---
// Your current role is to PLAN the report structure to get initial get feedback from the user. You are NOT writing content yet.

// INPUTS:
// - Structure Requirements: ${structureInstructions} 
// - Photo Count: ${selectedImageIds.length}

// AVAILABLE PHOTOS (use the [ID: ...] UUIDs exactly as shown):
// ${photoContext}

// ${userFeedback ? `!!! ATTENTION: PLAN REVISION !!!
//   The user REJECTED your previous plan.
//   USER FEEDBACK: "${userFeedback}"
  
//   HERE IS YOUR PREVIOUS PLAN (The one that was rejected):
//   \`\`\`json
//   ${JSON.stringify(existingPlan, null, 2)}
//   \`\`\`
  
//   INSTRUCTIONS FOR REVISION:
//   1. Keep the parts of the plan that work.
//   2. ONLY change the sections mentioned in the feedback.
//   3. Submit the FULL revised plan (all sections) again.
//   ` : ''} 

// YOUR TASK:
// 1. Analyze what needs to be covered based on the inputs.
// 2. Propose a logical structure (sections) for the report.
// 3. Assign photo IDs to relevant sections (photos can appear in multiple sections if needed).
// 4. Use the 'submitReportPlan' tool to output your plan in structured format.

// GUIDELINES:
// 1. **Execution Order (The Array):** You MUST output the 'sections' array in the order we should WRITE them.
//    - Start with Data/Observations (so we have facts).
//    - End with Summaries (so we can summarize the facts).

// 2. **Report Order (The Field):** For each section, assign the correct 'reportOrder' number for the Final PDF.
//    - Executive Summary should be 'reportOrder: 1'.
//    - Observations should be 'reportOrder: 2'.
//    - Recommendations should be 'reportOrder: 3'.

// ### EXAMPLE OUTPUT FORMAT
//   {
//     "reasoning": "...",
//     "sections": [
//       { 
//         "sectionId": "obs-roof", 
//         "title": "Roof Observations", 
//         "reportOrder": 2,
//         "purpose": "To document membrane deficiencies",
//         "photoContext": [
//            { "photoId": "aa54020a-...", "note": "Active leak observed at drain." },
//            { "photoId": "bb12345b-...", "note": "Overview of south elevation." }
//         ]
//       },
//       {
//         "sectionId": "exec-summary",
//         "title": "Executive Summary",
//         "reportOrder": 1,
//         "photoContext": []
        
//       }
//     ]
//   }
//   ...

// OUTPUT: Call 'submitReportPlan' with your proposed structure.`;

//   const baseModel = ModelStrategy.getModel(provider || 'gemini-cheap');


//   const model = baseModel?.bindTools?.([planningTool], {
//     tool_choice: "submitReportPlan" // <--- FORCE IT
//   });

//   const response = await model?.invoke?.([
//     new SystemMessage(promptContext),
//     ...state.messages
//   ]);

//   // Extract the plan from tool call
//   let reportPlan = null;
//   let toolResultMsg = null; // Prepare the result message
//   const aiMsg = response as AIMessage;
//   if (aiMsg.tool_calls && aiMsg.tool_calls.length > 0) {
//     const call = aiMsg.tool_calls[0];

//     // Create the "Receipt" that closes the loop
//     toolResultMsg = new ToolMessage({
//       tool_call_id: call.id || '', // MUST match the AI's call ID
//       name: call.name,
//       content: "Plan generated and saved successfully. Ready for approval."
//     });

//     if (call.name === 'submitReportPlan') {
//       reportPlan = {
//         sections: call.args.sections,
//         strategy: call.args.strategy,
//         reasoning: call.args.reasoning
//       };
//     }
//   }

//   // 💾 SAVE TO DB for the Frontend
//   // This signals the frontend to show the approval modal
//   if (draftReportId && client) {
//     try {
//       await Container.reportService.updateReportStatus(draftReportId, {
//         plan: reportPlan,          // Save the JSON plan
//         status: 'AWAITING_APPROVAL' // Signal the frontend to wake up
//       }, client);
//       console.log('✅ Report plan saved to database');
//     } catch (error) {
//       console.error('❌ Failed to save report plan:', error);
//       // Continue execution even if save fails - the plan is still in state
//     }
//   } else {
//     console.warn('⚠️ No draftReportId or client provided - skipping DB save');
//   }

//   return {
//     messages: toolResultMsg ? [response, toolResultMsg] : [response], // 👈 FIX IS HERE,
//     reportPlan,
//     approvalStatus: 'PENDING',
//     next_step: 'human_approval'
//   };
// }

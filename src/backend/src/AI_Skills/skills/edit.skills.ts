import { researchSkills } from './research.skills';

/**
 * Edit Skills – tools available to the Edit agent (EditOrchestrator).
 *
 * Used for selection-based editing only. Context (selection + surrounding) is
 * always provided by the client; these skills do NOT fetch report content from
 * the DB. They allow the edit agent to research and propose better edits.
 *
 * Currently: research (internal knowledge + web). Add edit-specific tools here
 * as needed (e.g. checkStandard, suggestTerminology).
 */
export const editSkills = (projectId: string) => ({
  ...researchSkills(projectId),
  // Future: checkStandard, suggestTerminology, etc.
});

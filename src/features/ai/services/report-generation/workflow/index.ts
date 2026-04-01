import { logger } from "@/lib/logger";
import { observationReportGraph } from "./report/observation-report-graph";
import { CompiledStateGraph } from "@langchain/langgraph";

// This is your Strategy Registry
// Add new workflow graphs here as you create them
// Use type assertion so different graph shapes (node names, state) are accepted in the registry
const WORKFLOWS: Record<string, CompiledStateGraph<any, any>> = {
  // "simple": simpleReportGraph as CompiledStateGraph<any, any>,
  "observation": observationReportGraph as CompiledStateGraph<any, any>,

  // Easy to add more strategies:
  // "advanced": advancedReportGraph as CompiledStateGraph<any, any>,
  // "quick": quickReportGraph as CompiledStateGraph<any, any>,
};

export type WorkflowType = keyof typeof WORKFLOWS;

/**
 * Get a workflow graph by type
 * @param workflowType - The type of workflow to retrieve
 * @returns The compiled workflow graph, or null if the type is unknown
 */
export function getWorkflow(workflowType: string): CompiledStateGraph<any, any> | null {
  const workflow = WORKFLOWS[workflowType];

  if (!workflow) {
    const availableWorkflows = Object.keys(WORKFLOWS).join(", ");
    logger.error(
      `Workflow type '${workflowType}' not found. Available workflows: ${availableWorkflows}`
    );
    return null;
  }

  return workflow;
}

/**
 * Get all available workflow types
 * @returns Array of available workflow type names
 */
export function getAvailableWorkflows(): string[] {
  return Object.keys(WORKFLOWS);
}
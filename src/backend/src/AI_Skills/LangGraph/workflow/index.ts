import { simpleReportGraph } from "./report/simpleReportGraph";
import { observationReportGraph } from "./report/ObservationReportGraph";
import { CompiledStateGraph } from "@langchain/langgraph";

// This is your Strategy Registry
// Add new workflow graphs here as you create them
// Use type assertion so different graph shapes (node names, state) are accepted in the registry
const WORKFLOWS: Record<string, CompiledStateGraph<any, any>> = {
  "simple": simpleReportGraph as CompiledStateGraph<any, any>,
  "observation": observationReportGraph as CompiledStateGraph<any, any>,

  // Easy to add more strategies:
  // "advanced": advancedReportGraph as CompiledStateGraph<any, any>,
  // "quick": quickReportGraph as CompiledStateGraph<any, any>,
};

export type WorkflowType = keyof typeof WORKFLOWS;

/**
 * Get a workflow graph by type
 * @param workflowType - The type of workflow to retrieve
 * @returns The compiled workflow graph
 * @throws Error if workflow type is not found
 */
export function getWorkflow(workflowType: string): CompiledStateGraph<any, any> {
  const workflow = WORKFLOWS[workflowType];
  
  if (!workflow) {
    const availableWorkflows = Object.keys(WORKFLOWS).join(", ");
    throw new Error(
      `Workflow type '${workflowType}' not found. Available workflows: ${availableWorkflows}`
    );
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
import { logger } from "@/lib/logger";
import type { CompiledStateGraph } from "@langchain/langgraph";

export type WorkflowType = "observation";

let observationWorkflowCache: CompiledStateGraph<any, any> | null = null;

function getObservationWorkflow(): CompiledStateGraph<any, any> {
  if (!observationWorkflowCache) {
    // Lazy require: avoids loading LangGraph graph + Postgres checkpointer until a workflow runs.
    // (Otherwise any import of this module via ReportOrchestrator would connect to Postgres.)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("./report/observation-report-graph") as {
      observationReportGraph: CompiledStateGraph<any, any>;
    };
    observationWorkflowCache = mod.observationReportGraph;
  }
  return observationWorkflowCache;
}

/**
 * Get a workflow graph by type
 * @param workflowType - The type of workflow to retrieve
 * @returns The compiled workflow graph, or null if the type is unknown
 */
export function getWorkflow(workflowType: string): CompiledStateGraph<any, any> | null {
  if (workflowType === "observation") {
    return getObservationWorkflow();
  }

  const availableWorkflows = "observation";
  logger.error(
    `Workflow type '${workflowType}' not found. Available workflows: ${availableWorkflows}`,
  );
  return null;
}

/**
 * Get all available workflow type names
 */
export function getAvailableWorkflows(): string[] {
  return ["observation"];
}

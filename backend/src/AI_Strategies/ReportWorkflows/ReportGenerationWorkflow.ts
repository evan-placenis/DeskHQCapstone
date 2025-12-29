import { AgentStrategy, ExecutionModeStrategy } from "../strategies/interfaces";
import { AgentExecutionContext } from "../strategies/interfaces"; 
import { Project } from "../../domain/core/project.types";
import { Report } from "../../domain/reports/report.types";
/**
 * The Context Briefcase.
 * Holds everything the agents need to know during the workflow.
 */

/**
 * The Abstract Workflow.
 * T = The type of data passed from Step 2 (Agent) to Step 3 (Builder).
 * For Observation Reports, T will be 'Section[]'.
 */
export abstract class ReportGenerationWorkflow<T = any> {

    // The Master Orchestrator
    public async generateReport(project: Project, payload: any): Promise<Report> {
        console.log("🚀 Starting Report Workflow...");

        // Step A: Validate & Collect Data
        const context = await this.collectInputs(project, payload);

        // Step B: Global Knowledge Retrieval (Optional)
        // Note: Specific RAG (like finding specs for a specific chapter) happens inside invokeAgent
        await this.retrieveContextWithRAG(context);

        // Step C: The Intelligence (Plan -> Loop -> Write)
        const agentOutput = await this.invokeAgent(context);

        // Step D: Format and Save
        const finalReport = await this.postProcessOutput(agentOutput, context);

        return finalReport;
    }

    // --- Abstract Steps ---
    
    // 1. Validation
    protected abstract collectInputs(project: Project, payload: any): Promise<AgentExecutionContext>;

    // 2. The Brain (Returns T, which can be an Object, Array, or String)
    protected abstract invokeAgent(context: AgentExecutionContext): Promise<T>;

    // 3. The Builder (Takes T and makes a Report)
    protected abstract postProcessOutput(agentOutput: T, context: AgentExecutionContext): Promise<Report>;

    // --- Shared Logic ---
    protected async retrieveContextWithRAG(context: AgentExecutionContext): Promise<void> {
        // Default: Do nothing. Child classes can override if they need Global Context.
        console.log("⏭️ Skipping Global RAG (Child workflow may handle local RAG).");
    }
}

// That covers the main design patterns! You have:

// Factory (creating objects)

// Strategy (swapping AI brains)

// Template Method (controlling the workflow)

// Builder (constructing the result)
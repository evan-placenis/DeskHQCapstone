import { ExecutionModeStrategy, AgentExecutionContext } from "../interfaces";

export class TextOnlyMode implements ExecutionModeStrategy {
  prepareInput(context: AgentExecutionContext): any {
    console.log("📝 Mode: Reading TEXT only. Ignoring images.");
    return {
      text: `Project: ${context.project.name}. Context: ${context.retrievedContext.join("\n")}`
    };
  }
}
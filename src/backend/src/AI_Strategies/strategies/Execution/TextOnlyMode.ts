import { ExecutionModeStrategy, AgentExecutionContext } from "../interfaces";

export class TextOnlyMode implements ExecutionModeStrategy {
  async prepareInput(context: AgentExecutionContext): Promise<any> {
    console.log("📝 Mode: Reading TEXT only. Ignoring images.");
    return {
      text: `Project: ${context.project.name}. Context: ${context.retrievedContext.join("\n")}`
    };
  }
}

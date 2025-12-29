import { ExecutionModeStrategy, AgentExecutionContext } from "../interfaces";

export class ImageAndTextMode implements ExecutionModeStrategy {
  prepareInput(context: AgentExecutionContext): any {
    console.log("👁️📝 Mode: Reading TEXT and IMAGES.");
    return {
      text: `Project: ${context.project.name}`,
      images: context.selectedImages
    };
  }
}
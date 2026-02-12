import { BaseMessage } from "@langchain/core/messages";
import { Annotation } from "@langchain/langgraph";


/**
 * This is the "Shared Blackboard" that all your agents can read/write to.
 */
export const TeamState = Annotation.Root({
  // 1. Chat History
  // We use a 'reducer' so that new messages are ADDED to the array, not overwriting it.
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),

  // 2. Context & Config
  context: Annotation<string>(),
  projectId: Annotation<string>(),
  userId: Annotation<string>(),
  client: Annotation<any>(), // Use 'any' or 'SupabaseClient' if type is available
  selectedImageIds: Annotation<string[]>({ value: (x, y) => x.concat(y), default: () => [] }),
  provider: Annotation<string>(),

  // 3. Execution State (The missing part!)
  currentSection: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "init",
  }),
  
  // FIX FOR ERROR #2: Add next_step
  next_step: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "supervisor",
  }),

  draftReportId: Annotation<string | undefined>(),
});
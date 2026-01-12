// domain/tools/definitions.ts
import { z } from "zod";

// Tool 1: Swap an Image
export const SwapImageSchema = z.object({
  action: z.literal("SWAP_IMAGE"),
  targetImageId: z.string().describe("The ID of the image to replace (found in the markdown tags)"),
  searchQuery: z.string().describe("What kind of image to find instead (e.g. 'tunnel construction')")
});

// Tool 2: Reorder Bullets (Bonus complex action)
export const ReorderBulletsSchema = z.object({
  action: z.literal("REORDER_BULLETS"),
  newOrder: z.array(z.number()).describe("The new indices for the bullet points")
});

// The Registry of all allowed tools
export const ReportToolsSchema = z.discriminatedUnion("action", [
  SwapImageSchema,
  ReorderBulletsSchema
]);

export type ReportToolAction = z.infer<typeof ReportToolsSchema>;
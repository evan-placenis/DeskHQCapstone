// infrastructure/utils/DiffUtils.ts
import * as Diff from 'diff';

export interface DiffStats {
  added: number;
  removed: number;
  changeSummary: string;
  hasChanges: boolean;
}

export class DiffUtils {

  /**
   * 🟢 MISSING METHOD FIXED
   * Generates the raw diff array required for text highlighting.
   * Returns an array of objects: { value: string, added?: boolean, removed?: boolean }
   */
  public static computeDiff(original: string, newText: string): Diff.Change[] {
    // We use diffWords for natural language (articles, essays).
    // Use diffChars if you want character-level precision (code, strict formatting).
    return Diff.diffWords(original, newText);
  }

  /**
   * Compares the original text with the AI's rewritten text.
   * Returns statistics we can show on the UI card.
   */
  public static calculateDiffStats(original: string, newText: string): DiffStats {
    // 1. Get the diffs using the method we just created
    const diffs = this.computeDiff(original, newText);

    let addedCount = 0;
    let removedCount = 0;

    diffs.forEach(part => {
      // Split by whitespace to get a rough word count
      const words = part.value.trim().split(/\s+/).filter(w => w.length > 0);
      
      if (part.added) {
        addedCount += words.length;
      }
      if (part.removed) {
        removedCount += words.length;
      }
    });

    const hasChanges = addedCount > 0 || removedCount > 0;

    return {
      added: addedCount,
      removed: removedCount,
      hasChanges: hasChanges,
      changeSummary: hasChanges 
        ? `+${addedCount} words, -${removedCount} words` 
        : "No significant changes detected."
    };
  }

  /**
   * Optional: If you need to generate a "Patch" format to store in DB
   */
  public static createPatch(fileName: string, original: string, newText: string) {
    return Diff.createTwoFilesPatch(fileName, fileName, original, newText);
  }
}
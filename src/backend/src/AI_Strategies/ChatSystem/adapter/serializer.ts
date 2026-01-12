//Adapter Pattern - report serializer to transform the report data into markdown or json
// lib/report/report-serializer.ts

import { 
    MainSectionBlueprint, 
    SubSectionBlueprint, 
    bulletpointBlueprint 
  } from "../../../domain/reports/report.types";


// Helper type for the Stack: It can hold ANY layer of your report
type StackNode = {
  level: number;
  // We use 'any' here effectively because we are building the tree dynamically.
  // This bypasses the error: "Type X is not assignable to Type Y" during the push.
  node: Partial<MainSectionBlueprint> | Partial<SubSectionBlueprint> | any; 
};

  export class DataSerializer {
  // =========================================================
  // 🟢 1. UNIVERSAL RECURSIVE GENERATOR (JSON -> Markdown)
  // =========================================================

  /**
   * Converts ANY section (Main, Sub, or future Deeply Nested) into Markdown.
   * Uses recursion to handle children automatically.
   */
  public toMarkdown(node: any, depth: number = 1): string {
      let output = "";

      // 1. Dynamic Header Generation
      // depth 1 = #, depth 2 = ##, etc.
      if (node.title) {
          output += `${"#".repeat(depth)} ${node.title}\n`;
      }

      // 2. Context / Description
      // We can style it differently based on depth if we want
      if (node.description) {
          const prefix = depth === 1 ? "> **Overview:** " : "*Context: ";
          const suffix = depth === 1 ? "" : "*";
          output += `${prefix}${node.description}${suffix}\n\n`;
      }

      // 3. Process Children (The Recursive Magic)
      if (node.children && node.children.length > 0) {
          
          // CHECK: Are we at the bottom (Bullets)? or still in Sections?
          const firstChild = node.children[0];
          const isBulletLayer = 'point' in firstChild; // Duck typing check

          if (isBulletLayer) {
              // BASE CASE: Render Bullets
              node.children.forEach((b: bulletpointBlueprint) => {
                  output += `- ${b.point}\n`;
                  if (b.images && b.images.length > 0) {
                      b.images.forEach((img: any) => {
                          output += `  > [IMAGE: ${img.caption || "Attached Image"}]\n`;
                      });
                  }
              });
          } else {
              // RECURSIVE STEP: Render Children Sections
              node.children.forEach((child: any) => {
                  output += "\n" + this.toMarkdown(child, depth + 1);
              });
          }
      } else {
          // Handle empty sections elegantly
          if (depth > 1) output += "(No content yet)\n";
      }

      return output.trim();
  }


  // =========================================================
  // 🟢 2. STACK-BASED PARSER (Markdown -> JSON)
  // =========================================================

  /**
   * Parses Markdown back into a Tree structure.
   * Uses a "Stack" to handle arbitrary nesting depth (#, ##, ###, ####...)
   * This replaces all those specific 'if' checks.
   */
  public markdownToSectionStructure(markdown: string): Partial<MainSectionBlueprint> {
      const lines = markdown.split('\n');
      
      // The Root of our result
      const root: any = { children: [] };
      
      // THE STACK: Keeps track of where we are in the hierarchy
      // We start with the root at level 0
      const stack: StackNode[] = [
          { level: 0, node: root }
      ];

      let pendingImages: any[] = [];

      for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          // --- A. HEADERS (#, ##, ###) ---
          const headerMatch = trimmed.match(/^(#+)\s+(.*)/);
          if (headerMatch) {
              const level = headerMatch[1].length; // number of #
              const title = headerMatch[2];

              const newSection = {
                  title: title,
                  description: "",
                  children: [],
                  // Optional: You could infer required/order here if needed
              };

              // 1. Pop stack until we find the parent (a level strictly lower than ours)
              while (stack.length > 0 && stack[stack.length - 1].level >= level) {
                  stack.pop();
              }

              // 2. The item currently at top of stack is our parent
              const parent = stack[stack.length - 1].node;
              
              // 3. Attach ourselves to parent
              // Note: We assume parent.children exists. 
              if (!parent.children) parent.children = [];
              parent.children.push(newSection);

              // 4. Push ourselves onto stack to accept future children
              stack.push({ level, node: newSection });
              
              continue; // Done with this line
          }

          // --- B. BULLETS (- , * ) ---
          // Get the current active section (top of stack)
          const currentSection = stack[stack.length - 1].node;

          if (/^[-*•] |^\d+\.\s/.test(trimmed)) {
              const content = trimmed.replace(/^[-*•] |^\d+\.\s/, '').trim();
              const bullet = { 
                  point: content, 
                  images: [...pendingImages] 
              };
              pendingImages = []; // Reset

              // Ensure children array exists
              if (!currentSection.children) currentSection.children = [];
              currentSection.children.push(bullet);
          }

          // --- C. IMAGES ---
          else if (trimmed.startsWith('> [IMAGE:')) {
              const caption = trimmed.replace('> [IMAGE:', '').replace(']', '').trim();
              pendingImages.push({ caption });
          }

          // --- D. DESCRIPTION / CONTEXT ---
          else if (trimmed.startsWith('> **Overview:**')) {
              currentSection.description = trimmed.replace('> **Overview:**', '').trim();
          }
          else if (!trimmed.startsWith('>')) {
               // It's regular text, append to description of whatever section is active
               if (!trimmed.match(/^---+$/)) { // Ignore horizontal rules
                   currentSection.description = (currentSection.description ? currentSection.description + "\n" : "") + trimmed;
               }
          }
      }

      // Return the children of our invisible root (or just the root if you want the wrapper)
      // Based on your specific MainSectionBlueprint type, you probably want the first child 
      // if the markdown started with '# Title', or the root wrapper if it contained multiple '#'.
      
      // Heuristic: If root has 1 child and it looks like a Main Section, return it.
      if (root.children && root.children.length === 1 && root.children[0].children) {
           return root.children[0];
      }
      
      return root as MainSectionBlueprint;
  }

  // ... helper methods like extractMetadataContext ...


    /**
     * Extracts metadata context from the section.
     */
    public extractMetadataContext(section: any): string {
        // Simple implementation
        return `Section ID: ${section.id || 'Unknown'}, Title: ${section.title || 'Untitled'}`;
    }
  }

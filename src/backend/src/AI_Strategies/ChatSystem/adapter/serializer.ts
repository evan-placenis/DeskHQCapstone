// lib/report/report-serializer.ts

import { MainSectionBlueprint } from "../../../domain/reports/report.types";

export class DataSerializer { //curently not being used I think

    // 🟢 A Recursive-Capable Parser using a Stack
    public static parseFullMarkdownToSections(fullMarkdown: string): any[] {
        const lines = fullMarkdown.split('\n');
        const sections: any[] = [];

        // The stack holds the current hierarchy path.
        // stack[0] is the main section (#), stack[1] is subsection (##), etc.
        // Each item in the stack is: { node: any, level: number }
        const stack: { node: any, level: number }[] = [];
        let currentBuffer = "";

        const flushBuffer = () => {
            const text = currentBuffer.trim();
            if (!text) return;

            // Attach text to the deepest active node
            if (stack.length > 0) {
                const active = stack[stack.length - 1].node;

                // If the text looks like a list item, we can parse it structurally
                // Otherwise, append to content/description
                if (active.content) {
                    active.content += "\n\n" + text;
                } else {
                    active.content = text;
                }

                // (Optional) If you want to support recovering bullets as children:
                // if (text.startsWith('- ')) active.children = parseBullets(text);
            }
            currentBuffer = "";
        };

        for (const line of lines) {
            const trimmed = line.trim();

            // 1. Detect Header (Any Level #, ##, ###...)
            const headerMatch = trimmed.match(/^(#+)\s+(.*)/);

            if (headerMatch) {
                flushBuffer(); // Save pending text to the previous node

                const level = headerMatch[1].length; // #=1, ##=2, ###=3
                const title = headerMatch[2];

                const newNode = {
                    title: title,
                    content: "",
                    children: [], // Unified children array for recursion
                    subSections: [] // For legacy compatibility (Level 1 only)
                };

                // 2. Adjust Stack for new Level
                // Pop items from the stack until we find the parent (level - 1)
                while (stack.length > 0 && stack[stack.length - 1].level >= level) {
                    stack.pop();
                }

                if (stack.length === 0) {
                    // Root Level (Level 1)
                    sections.push(newNode);
                } else {
                    // Child Level (Level > 1) -> Add to parent's children
                    const parent = stack[stack.length - 1].node;

                    // Add to 'children' (Universal)
                    if (!parent.children) parent.children = [];
                    parent.children.push(newNode);

                    // Add to 'subSections' (Legacy: Only if parent is Root and child is Level 2)
                    if (stack.length === 1 && level === 2) {
                        if (!parent.subSections) parent.subSections = [];
                        parent.subSections.push(newNode);
                    }
                }

                // Push new node as the active context
                stack.push({ node: newNode, level: level });
                continue;
            }

            // 3. Regular Content
            currentBuffer += line + "\n";
        }

        flushBuffer(); // Final flush
        return sections;
    }

    // 🟢 1. JSON -> MARKDOWN (Adjusted for Tiptap Compatibility)
    public toMarkdown(node: any, depth: number = 1): string {
        let output = "";

        // Headers (# Title)
        if (node.title && depth > 0) { // depth 0 might be root wrapper
            output += `${"#".repeat(depth)} ${node.title}\n\n`;
        }

        // Description
        if (node.description) {
            output += `${node.description}\n\n`;
        } else if (node.content) {
            // Fallback if your data uses 'content' property
            output += `${node.content}\n\n`;
        }

        // Children
        if (node.children && node.children.length > 0) {
            const firstChild = node.children[0];
            const isBulletLayer = 'point' in firstChild;

            if (isBulletLayer) {
                node.children.forEach((b: any) => {
                    output += `- ${b.point}\n`;
                    // 🟢 FIX: Use Standard Markdown Image Syntax for Tiptap
                    if (b.images && b.images.length > 0) {
                        b.images.forEach((img: any) => {
                            // Format: ![Alt Text](URL)
                            const url = img.url || img.storagePath || "";
                            output += `![${img.caption || "Image"}](${url})\n`;
                        });
                    }
                });
                output += "\n"; // Space after list
            } else {
                node.children.forEach((child: any) => {
                    output += this.toMarkdown(child, depth + 1) + "\n";
                });
            }
        }
        return output.trim();
    }

    // 🟢 2. MARKDOWN -> JSON (Robustness Fixes)
    public static markdownToSectionStructure(markdown: string): Partial<MainSectionBlueprint> {
        const lines = markdown.split('\n');
        const root: any = { children: [] };

        // Default to parsing into a root node if no headers found (flat text)
        // This handles the case where user just types a paragraph without a header
        const stack: any[] = [{ level: 0, node: root }];

        let currentDescriptionBuffer = "";

        // Helper to flush description buffer to current node
        const flushDescription = () => {
            if (currentDescriptionBuffer.trim()) {
                const currentNode = stack[stack.length - 1].node;
                // Append to existing or create new
                currentNode.description = (currentNode.description || "") + "\n" + currentDescriptionBuffer.trim();
                currentDescriptionBuffer = "";
            }
        };

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // Headers
            const headerMatch = trimmed.match(/^(#+)\s+(.*)/);
            if (headerMatch) {
                flushDescription(); // Save previous text

                const level = headerMatch[1].length;
                const title = headerMatch[2];
                const newSection = { title, description: "", children: [] };

                // Pop stack to find parent
                while (stack.length > 0 && stack[stack.length - 1].level >= level) {
                    stack.pop();
                }

                const parent = stack[stack.length - 1].node;
                if (!parent.children) parent.children = [];
                parent.children.push(newSection);
                stack.push({ level, node: newSection });
                continue;
            }

            // Bullets
            if (/^[-*•] /.test(trimmed)) {
                flushDescription(); // Save previous text
                const point = trimmed.replace(/^[-*•] /, '').trim();

                const currentSection = stack[stack.length - 1].node;
                if (!currentSection.children) currentSection.children = [];

                // Add as bullet child
                currentSection.children.push({ point, images: [] });
                continue;
            }

            // Images (Standard Markdown: ![alt](url))
            const imgMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)/);
            if (imgMatch) {
                const caption = imgMatch[1];
                const url = imgMatch[2];

                // Attach to the LAST child (bullet) if it exists, otherwise attach to section?
                // Simplified: We assume images belong to the last bullet point or section
                const currentSection = stack[stack.length - 1].node;
                const lastChild = currentSection.children ? currentSection.children[currentSection.children.length - 1] : null;

                if (lastChild && 'point' in lastChild) {
                    if (!lastChild.images) lastChild.images = [];
                    lastChild.images.push({ caption, url });
                }
                continue;
            }

            // Plain Text -> Buffer it
            currentDescriptionBuffer += " " + trimmed;
        }

        flushDescription(); // Final flush

        // Return the structure
        // If we parsed a full tree, return root.children[0]. 
        // If we just parsed a paragraph (no headers), return the root content as a section description.
        if (root.children.length > 0) return root.children[0];

        return {
            title: "General Content",
            description: root.description || "",
            children: []
        };
    }
}
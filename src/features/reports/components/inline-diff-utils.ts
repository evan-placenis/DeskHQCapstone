"use client";

import { diffWordsWithSpace } from 'diff';
import type { Editor } from '@tiptap/core';
import { create } from 'jsondiffpatch';
import { DiffPatcher } from 'jsondiffpatch';

const diffPatcher = new DiffPatcher({
  objectHash: (obj: any) => {
    // The engine now relies entirely on the _idx we stamp onto the objects
    if (obj.type === 'text') {
      return `text_${JSON.stringify(obj.marks || [])}_${obj._idx}`;
    }
    return `${obj.type}_${obj._idx}`;
  },
  arrays: { 
    detectMove: false // We lock them in place positionally
  },
});

/**
 * Safely extracts the official Tiptap Markdown parser.
 */
function getMarkdownParser(editor: any) {
  // The official @tiptap/markdown extension exposes 'editor.markdown'
  if (editor.markdown && typeof editor.markdown.parse === 'function') {
    return editor.markdown;
  }

  // Fallback for older versions or specific configurations
  const storage = editor.storage.markdown || editor.storage.Markdown;
  if (storage && typeof storage.parse === 'function') return storage;
  
  return null;
}


export function applyLibraryDiff(
  editor: any,
  range: { from: number; to: number },
  aiGeneratedMarkdown: string
): { from: number; to: number } | null {
  const changeId = Math.random().toString(36).substring(7);

  // 1. Get old nodes
  const oldNodes = editor.state.doc.slice(range.from, range.to).toJSON().content || [];

  // 2. Parse new nodes
  const parser = getMarkdownParser(editor);
  if (!parser) {
    console.error("DeskHQ Error: Markdown parser missing.");
    return null;
  }
  const newDoc = parser.parse(aiGeneratedMarkdown);
  let newNodes = newDoc.content || newDoc.toJSON().content || [];

  const oldIsTextOnly = oldNodes.every((n: any) => n.type === 'text');
  if (oldIsTextOnly && newNodes.length === 1 && newNodes[0].type === 'paragraph') {
    newNodes = newNodes[0].content || [];
  }

  // ------------------------------------------------------------------
  // THE CORE FIX: THE INDEX STAMP
  // We recursively walk through the JSON trees and stamp every node 
  // with its array index. This guarantees jsondiffpatch will align 
  // them perfectly and do surgical word-level diffs inside the blocks.
  // ------------------------------------------------------------------
  const injectIndex = (nodes: any[]) => {
    if (!Array.isArray(nodes)) return;
    nodes.forEach((n, i) => {
      if (n && typeof n === 'object') {
        n._idx = i;
        if (n.content) injectIndex(n.content);
      }
    });
  };
  
  injectIndex(oldNodes);
  injectIndex(newNodes);

  // 3. Mathematical Diff
  const delta = diffPatcher.diff(oldNodes, newNodes);

  console.log("=== 1. RAW DELTA ===");
  console.log(JSON.stringify(delta, null, 2));

  // 4. Translate and Insert
  const diffNodes = translateDeltaToTipTap(oldNodes, newNodes, delta, changeId);
  editor.commands.insertContentAt(range, diffNodes);

  return { from: range.from, to: range.from + diffNodes.length };
}

function translateDeltaToTipTap(oldNodes: any[], newNodes: any[], delta: any, changeId: string): any[] {
  // If there's no delta, nothing changed. Return the new nodes exactly as they are.
  if (!delta) return newNodes;

  const result: any[] = [];
  let oldIndex = 0; // Tracks our position in the ORIGINAL document

  // We loop through the NEW document, matching it against the delta
  for (let newIndex = 0; newIndex < newNodes.length; newIndex++) {
    
    // ------------------------------------------------------------------
    // STEP 1: CATCH DELETIONS (The "_X" keys)
    // jsondiffpatch marks deletions with an underscore (e.g., "_0", "_1").
    // We use a `while` loop because there might be multiple deleted items
    // in a row before we get to the next piece of kept/new content.
    // ------------------------------------------------------------------
    while (delta[`_${oldIndex}`]) {
      const delChange = delta[`_${oldIndex}`];
      
      // 🔬 SURGICAL LOG 2A: DELETIONS
      console.log(`[Diff] 🗑️ Deletion caught at oldIndex: ${oldIndex}`);
      
      result.push(recursivelyApplyMark(delChange[0], 'deletion', changeId));
      oldIndex++; // Move our pointer forward in the old document
    }

    // ------------------------------------------------------------------
    // STEP 2: PROCESS THE CURRENT NODE
    // We check the delta using the current numeric index (e.g., "0", "1")
    // ------------------------------------------------------------------
    const change = delta[newIndex.toString()];
    const newNode = newNodes[newIndex];
    const oldNode = oldNodes[oldIndex];

    // CASE A: UNCHANGED
    if (change === undefined) {
      result.push(newNode);
      oldIndex++;
    } 
    
    // CASE B: ADDITION (Array of length 1: [newThing])
    else if (Array.isArray(change) && change.length === 1) {
      // 🔬 SURGICAL LOG 2B: ADDITIONS
      console.log(`[Diff] 🟩 Addition caught at newIndex: ${newIndex}`);
      
      result.push(recursivelyApplyMark(change[0], 'addition', changeId));
      // NOTE: We do NOT increment oldIndex here because an addition 
      // doesn't "consume" anything from the old document.
    } 
    
    // CASE C: REPLACEMENT (Array of length 2: [oldThing, newThing])
    else if (Array.isArray(change) && change.length === 2) {
      // 🔬 SURGICAL LOG 2C: REPLACEMENTS
      console.log(`[Diff] 🔄 Replacement caught (Old: ${oldIndex} -> New: ${newIndex})`);

      // If both old and new are Text nodes, do a surgical word-level diff!
      if (oldNode?.type === 'text' && newNode?.type === 'text') {
        result.push(...performInlineTextDiff(oldNode, newNode, changeId));
      } else {
        // If they are blocks (like a table turning into a list), 
        // delete the whole old block and add the whole new block.
        result.push(recursivelyApplyMark(change[0], 'deletion', changeId));
        result.push(recursivelyApplyMark(change[1], 'addition', changeId));
      }
      oldIndex++;
    } 
    
    // CASE D: MODIFICATION (Deep Object Diff)
    else if (typeof change === 'object') {
      // 🔬 SURGICAL LOG 2D: MODIFICATIONS
      console.log(`[Diff] 🪚 Deep Modification at index: ${newIndex}`);

      // If a block node (like a table) changed inside, RECURSE into it.
      if (change.content) {
        result.push({
          ...newNode,
          content: translateDeltaToTipTap(
            oldNode?.content || [], 
            newNode?.content || [], 
            change.content, 
            changeId
          )
        });
      } 
      // If it's a text node that was modified (attributes changed, etc.)
      else if (newNode?.type === 'text' && oldNode) {
        result.push(...performInlineTextDiff(oldNode, newNode, changeId));
      } 
       // THE FIX: If it's a block node whose text 'content' DID NOT change,
      // it means only invisible metadata (like 'attrs') shifted. 
      // We accept the new node silently. No red/green needed!
      else {
        result.push(newNode);
      }
      oldIndex++;
    }
  }

  // ------------------------------------------------------------------
  // STEP 3: CATCH LEFTOVER DELETIONS
  // If the AI deleted the very last items in a list/paragraph, the 
  // 'newNodes' loop will finish before we catch them. This cleans them up.
  // ------------------------------------------------------------------
  while (oldIndex < oldNodes.length) {
    if (delta[`_${oldIndex}`]) {
      console.log(`[Diff] 🗑️ Trailing Deletion caught at oldIndex: ${oldIndex}`);
      result.push(recursivelyApplyMark(delta[`_${oldIndex}`][0], 'deletion', changeId));
    }
    oldIndex++;
  }

  return result;
}
// ─── 1. The Recursive Marker (For Structural Changes) ────────────────────────

/**
 * Recursively walks a TipTap/ProseMirror JSON node and applies a specific mark
 * to every single text node inside it.
 */
function recursivelyApplyMark(node: any, markType: string, changeId: string): any {
  // 1. Base Case: Text nodes OR inline "atom" nodes (like images/hardBreaks)
  // We check for !node.content to catch nodes that can't have children but can have marks.
  const isText = node.type === 'text';
  const isAtom = !node.content && node.type !== 'paragraph' && node.type !== 'tableRow';

  if (isText || isAtom) {
    const marks = node.marks ? [...node.marks] : [];
    
    // Check for existing mark by string name (JSON) or .name property (Live Node)
    const hasMark = marks.some(m => 
      (typeof m.type === 'string' ? m.type === markType : m.type.name === markType)
    );

    if (!hasMark) {
      marks.push({ type: markType, attrs: { changeId } });
    }
    
    return { ...node, marks: marks.length > 0 ? marks : undefined };
  }

  // 2. Recursive Case: Structural nodes (Paragraphs, Lists, Tables)
  if (node.content && Array.isArray(node.content)) {
    return {
      ...node,
      content: node.content.map((child: any) => 
        recursivelyApplyMark(child, markType, changeId)
      ),
    };
  }

  return node;
}
// ─── 3. Helper: Inline Word Differ ───────────────────────────────────────────
function performInlineTextDiff(oldNode: any, newNode: any, changeId: string): any[] {
  // 1. Defensive check
  if (!oldNode || typeof oldNode.text !== 'string') {
    return [recursivelyApplyMark(newNode, 'addition', changeId)];
  }

  const oldText = oldNode.text || '';
  const newText = newNode.text || '';
  
  if (oldText === newText) return [newNode];

  // 2. Run the word-level diff
  const chunks = diffWordsWithSpace(oldText, newText).filter(c => c.value.length > 0);
  
  return chunks.map(chunk => {
    // Logic: If it's NOT removed (meaning it's added or unchanged), use NEW marks.
    // If it IS removed, use OLD marks to preserve original formatting during deletion.
    const baseMarks = !chunk.removed ? (newNode.marks || []) : (oldNode.marks || []);
    
    // Clone marks to avoid mutating originals
    const marks = [...baseMarks];

    // 3. Apply the appropriate change mark
    if (chunk.added) {
      // Avoid pushing duplicate addition marks if already present
      if (!marks.some(m => m.type === 'addition')) {
        marks.push({ type: 'addition', attrs: { changeId } });
      }
    } else if (chunk.removed) {
      if (!marks.some(m => m.type === 'deletion')) {
        marks.push({ type: 'deletion', attrs: { changeId } });
      }
    }

    return {
      type: 'text',
      text: chunk.value,
      marks: marks.length > 0 ? marks : undefined
    };
  });
}




// ─── Public API ───────────────────────────────────────────────────────────────


/** * resolveChange: The only surgical function you need.
 * It finds all nodes in the tree with a specific ID and resolves them.
 */
export function resolveChange(editor: Editor, changeId: string, action: 'accept' | 'reject') {
  editor.commands.command(({ tr, dispatch }) => {
    if (!dispatch) return true;

    const toDelete: { from: number; to: number }[] = [];
    const toUnmark: { from: number; to: number; type: any }[] = [];

    // Walk the entire document tree
    tr.doc.descendants((node, pos) => {
      const addMark = node.marks?.find(m => m.type.name === 'addition' && m.attrs.changeId === changeId);
      const delMark = node.marks?.find(m => m.type.name === 'deletion' && m.attrs.changeId === changeId);

      if (addMark) {
        action === 'accept' 
          ? toUnmark.push({ from: pos, to: pos + node.nodeSize, type: addMark.type })
          : toDelete.push({ from: pos, to: pos + node.nodeSize });
      }

      if (delMark) {
        action === 'accept'
          ? toDelete.push({ from: pos, to: pos + node.nodeSize })
          : toUnmark.push({ from: pos, to: pos + node.nodeSize, type: delMark.type });
      }
    });

    // Apply unmarking first (doesn't shift positions)
    toUnmark.forEach(m => tr.removeMark(m.from, m.to, m.type));
    // Apply deletions in reverse (keeps indices valid)
    toDelete.reverse().forEach(r => tr.delete(r.from, r.to));

    cleanupEmptyStructures(tr);
    return true;
  });
}

/** * resolveAllChanges: Just a loop that finds every ID and calls resolveChange.
 */
export function resolveAllChanges(editor: Editor, action: 'accept' | 'reject') {
  const ids = new Set<string>();
  editor.state.doc.descendants(node => {
    node.marks.forEach(m => {
      if ((m.type.name === 'addition' || m.type.name === 'deletion') && m.attrs.changeId) {
        ids.add(m.attrs.changeId);
      }
    });
  });
  ids.forEach(id => resolveChange(editor, id, action));
}

// Pass the Transaction (tr) directly in, not the whole editor
export function cleanupEmptyStructures(tr: any) {
  const ghostPositions: { from: number; to: number }[] = [];

  // 1. Scan the document using the current transaction's state
  tr.doc.descendants((node: any, pos: number) => {
    if (node.type.name === 'tableRow' || node.type.name === 'listItem') {
      
      const hasNoText = node.textContent.trim() === '';
      let hasNoAtoms = true;
      
      node.descendants((child: any) => {
        if (child.isAtom || child.type.name === 'image') {
          hasNoAtoms = false;
        }
      });

      if (hasNoText && hasNoAtoms) {
        ghostPositions.push({ from: pos, to: pos + node.nodeSize });
      }
    }
  });

  // 2. Delete from BOTTOM to TOP 
  for (let i = ghostPositions.length - 1; i >= 0; i--) {
    const { from, to } = ghostPositions[i];
    tr.delete(from, to);
  }

}

/** Strip leading heading from markdown (e.g. "## General\n\ncontent" → "content"). */
export function stripLeadingHeading(text: string): string {
  return text.replace(/^#{1,6}\s+[^\n]*\n?/, '').trimStart();
}

import type { MutableRefObject } from "react";
import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { resolveBlock as resolveBlockImpl } from "@/src/features/reports/components/authoring/tiptap/diff/inline-diff-utils";

function collectHunks(doc: any): number[] {
  const hunkStarts = new Set<number>();

  doc.descendants((node: any, pos: number) => {
    if (!node.isText) return;

    const hasDiff = node.marks?.some((m: any) => m.type.name === "addition" || m.type.name === "deletion");
    if (hasDiff) {
      const $pos = doc.resolve(pos);
      hunkStarts.add($pos.before(1));
    }
  });

  return Array.from(hunkStarts);
}

function createPillElement(
  _changeIds: string[],
  top: number,
  onAction: (action: "accept" | "reject") => void,
): HTMLElement {
  const pill = document.createElement("div");
  pill.className =
    "flex items-center gap-1 px-1.5 py-1 rounded border border-slate-200 bg-white shadow-sm pointer-events-auto";
  pill.style.cssText = `position:absolute;top:${top}px;right:8px;z-index:30;transform:translateY(-50%);`;

  const mkBtn = (label: "accept" | "reject", icon: string, colorClass: string) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.innerHTML = icon;
    btn.title = label.charAt(0).toUpperCase() + label.slice(1);
    btn.className = `p-1 rounded transition-colors ${colorClass}`;
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onAction(label);
    });
    return btn;
  };

  const checkIcon =
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>';
  const xIcon =
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

  pill.appendChild(mkBtn("accept", checkIcon, "hover:bg-green-50 text-green-600"));
  pill.appendChild(mkBtn("reject", xIcon, "hover:bg-red-50 text-red-600"));

  return pill;
}

export function docHasChanges(doc: any): boolean {
  let hasChanges = false;
  doc.descendants((node: any) => {
    if (node.marks?.some((m: any) => m.type.name === "addition" || m.type.name === "deletion")) {
      hasChanges = true;
      return false;
    }
  });
  return hasChanges;
}

export function createChangeManagerExtension(onAllClear: MutableRefObject<(() => void) | undefined>) {
  return Extension.create({
    name: "changeManager",
    addProseMirrorPlugins() {
      const { editor } = this as { editor: Editor };
      return [
        new Plugin({
          key: new PluginKey("changeManager"),
          props: {
            decorations(state) {
              const decos: Decoration[] = [];
              state.doc.descendants((node, pos) => {
                const hasDiff = node.marks?.some(
                  (m) => m.type.name === "addition" || m.type.name === "deletion",
                );
                if (hasDiff) {
                  const $pos = state.doc.resolve(pos);
                  const blockStart = $pos.before(1);
                  const blockEnd = $pos.after(1);
                  decos.push(Decoration.node(blockStart, blockEnd, { class: "diff-hunk-active" }));
                }
              });
              return DecorationSet.create(state.doc, decos);
            },
          },
          view(editorView) {
            const overlay = document.createElement("div");
            overlay.className = "tiptap-diff-overlay";
            overlay.style.cssText =
              "position:absolute;top:0;right:0;bottom:0;left:0;pointer-events:none;z-index:20;";
            editorView.dom.parentElement?.appendChild(overlay);

            const render = () => {
              overlay.innerHTML = "";
              const hunks = collectHunks(editorView.state.doc);
              const overlayRect = overlay.getBoundingClientRect();

              hunks.forEach((blockStart) => {
                const coords = editorView.coordsAtPos(blockStart);
                if (!coords) return;

                const textCenterY = (coords.top + coords.bottom) / 2;
                const relativeTop = textCenterY - overlayRect.top;

                const pill = createPillElement([], relativeTop, (action: "accept" | "reject") => {
                  resolveBlockImpl(editor, blockStart, action);
                  if (!docHasChanges(editor.state.doc)) onAllClear.current?.();
                });

                overlay.appendChild(pill);
              });
            };

            return { update: render, destroy: () => overlay.remove() };
          },
        }),
      ];
    },
  });
}

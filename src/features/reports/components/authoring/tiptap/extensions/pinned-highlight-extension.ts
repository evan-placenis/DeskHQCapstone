import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/** Persistent highlight for pinned selection (e.g. blur to chat). */
export function createPinnedHighlightExtension(getRange: () => { from: number; to: number } | null) {
  return Extension.create({
    name: "pinnedHighlight",
    addProseMirrorPlugins() {
      return [
        new Plugin({
          props: {
            decorations(state) {
              const range = getRange();
              if (!range || range.from >= range.to) return null;
              const { from, to } = range;
              const docSize = state.doc.content.size;
              if (from < 0 || to > docSize) return null;
              const deco = Decoration.inline(from, to, { class: "pinned-selection-highlight" });
              return DecorationSet.create(state.doc, [deco]);
            },
          },
        }),
      ];
    },
  });
}

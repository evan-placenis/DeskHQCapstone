import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ReportImageComponent } from "@/features/reports/components/presentation/report-image-component";

/** Inline images with UUID-safe storage and legacy HTML parsing. */
export const CustomImageExtension = Image.extend({
  name: "image",
  draggable: true,
  inline: true,
  group: "inline",

  renderMarkdown: (node) => {
    const escapeAlt = (s: string) => String(s ?? "").replace(/\\/g, "\\\\").replace(/\]/g, "\\]");
    const escapeSrc = (s: string) =>
      String(s ?? "")
        .replace(/\\/g, "\\\\")
        .replace(/\)/g, "\\)")
        .replace(/\(/g, "\\(");
    const alt = escapeAlt(node.attrs?.alt ?? "");
    const src = escapeSrc(node.attrs?.src ?? "");
    return `![${alt}](${src})`;
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      src: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-src") || element.getAttribute("src"),
      },
      alt: { default: null },
      title: { default: null },
    };
  },

  parseHTML() {
    return [
      { tag: "img[data-src]" },
      { tag: "img[src]" },
      { tag: 'div[data-type="report-image"]' },
      { tag: 'span[data-type="report-image"]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "img",
      {
        ...HTMLAttributes,
        "data-type": "report-image",
        "data-src": HTMLAttributes.src,
        src: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
      },
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ReportImageComponent);
  },
}).configure({
  allowBase64: true,
  inline: true,
});

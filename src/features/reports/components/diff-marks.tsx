"use client";

import { Mark } from '@tiptap/core';

const changeIdAttr = {
  changeId: {
    default: null as string | null,
    parseHTML: (el: Element) => el.getAttribute('data-change-id'),
    renderHTML: (attrs: Record<string, unknown>) =>
      attrs.changeId ? { 'data-change-id': attrs.changeId } : {},
  },
};

/**
 * AdditionMark: Green background for inserted text
 */
export const AdditionMark = Mark.create({
  name: 'addition',

  addAttributes() {
    return changeIdAttr;
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-diff="addition"]',
      },
      {
        tag: 'span[data-type="addition"]', // Legacy support
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      {
        'data-diff': 'addition',
        class: 'bg-green-100 text-green-800 px-0.5 rounded',
        ...HTMLAttributes,
      },
      0,
    ];
  },
});

/**
 * DeletionMark: Red background with strikethrough for deleted text
 */
export const DeletionMark = Mark.create({
  name: 'deletion',

  addAttributes() {
    return changeIdAttr;
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-diff="deletion"]',
      },
      {
        tag: 'span[data-type="deletion"]', // Legacy support
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      {
        'data-diff': 'deletion',
        class: 'bg-red-100 text-red-800 px-0.5 rounded line-through',
        ...HTMLAttributes,
      },
      0,
    ];
  },
});

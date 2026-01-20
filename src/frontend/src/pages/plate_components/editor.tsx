import React from 'react';
import { PlateContent } from '@udecode/plate/react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/src/frontend/src/lib/utils';

const editorVariants = cva(
  cn(
    'relative overflow-x-hidden break-words whitespace-pre-wrap break-words',
    'min-h-[80px] w-full rounded-md bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none',
    '[&_[data-slate-placeholder]]:text-muted-foreground [&_[data-slate-placeholder]]:!opacity-100',
    '[&_strong]:font-bold'
  ),
  {
    variants: {
      variant: {
        outline: 'border border-input focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        ghost: '',
      },
      focused: {
        true: 'ring-2 ring-ring ring-offset-2',
      },
      disabled: {
        true: 'cursor-not-allowed opacity-50',
      },
      focusRing: {
        true: 'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        false: '',
      },
      size: {
        sm: 'text-sm',
        md: 'text-base',
      },
    },
    defaultVariants: {
      variant: 'outline',
      focusRing: true,
      size: 'sm',
    },
  }
);

// 🟢 FIX: We use VariantProps to automatically grab 'focused', 'variant', etc. from the CVA definition
export type EditorProps = React.ComponentProps<typeof PlateContent> & 
  VariantProps<typeof editorVariants> & {
    disabled?: boolean;
    focused?: boolean; // Explicitly adding this to be safe, though VariantProps usually catches it
  };

const Editor = React.forwardRef<HTMLDivElement, EditorProps>(
  ({ className, disabled, focused, focusRing, size, variant, ...props }, ref) => {
    return (
      <PlateContent
        ref={ref}
        className={cn(
          editorVariants({
            disabled,
            focused,
            focusRing,
            size,
            variant,
          }),
          className
        )}
        disableDefaultStyles
        readOnly={disabled}
        aria-disabled={disabled}
        {...props}
      />
    );
  }
);
Editor.displayName = 'Editor';

export { Editor };
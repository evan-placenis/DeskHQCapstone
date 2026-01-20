import React from 'react';
import * as ToolbarPrimitive from '@radix-ui/react-toolbar';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/src/frontend/src/lib/utils';
import { Separator } from '@radix-ui/react-separator';

const toolbarVariants = cva(
  'relative flex select-none items-stretch gap-1 bg-background'
);

export const Toolbar = React.forwardRef<
  React.ElementRef<typeof ToolbarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.Root> &
    VariantProps<typeof toolbarVariants>
>(({ className, ...props }, ref) => (
  <ToolbarPrimitive.Root
    ref={ref}
    className={cn(toolbarVariants(), className)}
    {...props}
  />
));
Toolbar.displayName = ToolbarPrimitive.Root.displayName;

const toolbarButtonVariants = cva(
  cn(
    'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
    'ring-offset-background'
  ),
  {
    variants: {
      variant: {
        default:
          'bg-transparent hover:bg-muted hover:text-muted-foreground aria-checked:bg-accent aria-checked:text-accent-foreground',
        outline:
          'border border-input bg-transparent hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: 'h-10 px-3',
        sm: 'h-9 px-2',
        lg: 'h-11 px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'icon',
    },
  }
);

// 🟢 FIX: Added 'tooltip' to the type definition
export const ToolbarButton = React.forwardRef<
  React.ElementRef<typeof ToolbarPrimitive.Button>,
  React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.Button> &
    VariantProps<typeof toolbarButtonVariants> & { tooltip?: string } 
>(({ className, variant, size, tooltip, ...props }, ref) => (
  <ToolbarPrimitive.Button
    ref={ref}
    // 🟢 FIX: Pass the tooltip prop to the native HTML title attribute
    title={tooltip} 
    className={cn(toolbarButtonVariants({ variant, size }), className)}
    {...props}
  />
));
ToolbarButton.displayName = ToolbarPrimitive.Button.displayName;

export const ToolbarSeparator = React.forwardRef<
  React.ElementRef<typeof ToolbarPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <ToolbarPrimitive.Separator
    ref={ref}
    className={cn('mx-2 w-[1px] bg-border', className)}
    {...props}
  />
));
ToolbarSeparator.displayName = ToolbarPrimitive.Separator.displayName;
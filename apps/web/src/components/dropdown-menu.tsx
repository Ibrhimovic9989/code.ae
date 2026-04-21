'use client';

import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu';
import { forwardRef, type HTMLAttributes, type ComponentPropsWithoutRef } from 'react';
import { cn } from '../lib/utils';

export const DropdownMenu = DropdownPrimitive.Root;
export const DropdownMenuTrigger = DropdownPrimitive.Trigger;
export const DropdownMenuSeparator = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof DropdownPrimitive.Separator>
>(function DropdownMenuSeparator({ className, ...props }, ref) {
  return (
    <DropdownPrimitive.Separator
      ref={ref}
      className={cn('my-1 h-px bg-neutral-200 dark:bg-neutral-800', className)}
      {...props}
    />
  );
});

export const DropdownMenuContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>
>(function DropdownMenuContent({ className, sideOffset = 6, ...props }, ref) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-[12rem] overflow-hidden rounded-lg border border-neutral-200 bg-white p-1 shadow-lg data-[state=open]:animate-fade-in dark:border-neutral-800 dark:bg-neutral-950',
          className,
        )}
        {...props}
      />
    </DropdownPrimitive.Portal>
  );
});

export const DropdownMenuItem = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof DropdownPrimitive.Item> & { destructive?: boolean }
>(function DropdownMenuItem({ className, destructive, ...props }, ref) {
  return (
    <DropdownPrimitive.Item
      ref={ref}
      className={cn(
        'flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition data-[highlighted]:bg-neutral-100 dark:data-[highlighted]:bg-neutral-800',
        destructive
          ? 'text-red-600 data-[highlighted]:bg-red-50 data-[highlighted]:text-red-700 dark:text-red-400 dark:data-[highlighted]:bg-red-950'
          : 'text-neutral-900 dark:text-neutral-50',
        className,
      )}
      {...props}
    />
  );
});

export function DropdownMenuLabel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-neutral-500', className)}
      {...props}
    />
  );
}

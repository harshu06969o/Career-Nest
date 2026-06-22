import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines Tailwind classes safely — resolves conflicts via tailwind-merge,
 * and supports conditional classes via clsx.
 *
 * Usage: cn('px-4 py-2', isActive && 'bg-emerald-500', className)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

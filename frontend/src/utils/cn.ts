import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Gộp className có điều kiện + tự loại bỏ conflict Tailwind (vd 2 class p-4 và p-6) */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Phải đăng ký fontSize tự thêm, không thì tailwind-merge xoá nhầm khi đứng cùng màu chữ
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['h1', 'h2', 'h3', 'body', 'small', 'caption', 'metric'] }],
    },
  },
})

// Gộp className có điều kiện + tự loại bỏ conflict Tailwind (vd 2 class p-4 và p-6)
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

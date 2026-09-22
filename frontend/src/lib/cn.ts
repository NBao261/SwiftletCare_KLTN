import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * tailwind-merge chỉ nhận diện font-size theo thang mặc định (xs…9xl) — các token
 * §2.8 khai báo thêm trong tailwind.config.ts (`text-h1`, `text-body`…) nếu không
 * đăng ký sẽ bị xếp nhầm vào nhóm "text-color" và bị xoá khi đứng cùng
 * `text-warmGray`/`text-charcoal`. Phải liệt kê đúng danh sách key `fontSize`.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['h1', 'h2', 'h3', 'body', 'small', 'caption', 'metric'] }],
    },
  },
})

/** Gộp className có điều kiện + tự loại bỏ conflict Tailwind (vd 2 class p-4 và p-6) */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

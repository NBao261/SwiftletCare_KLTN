import type { InputHTMLAttributes } from 'react'
import { Input } from '@/components/ui/Input'
import { IconSearch } from '@/components/ui/icons'
import { cn } from '@/lib/cn'

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string
  onChange: (value: string) => void
}

/**
 * Ô tìm kiếm dùng chung (AdminUsersPage, AdminAuditLogPage): kính lúp bên trái +
 * nút × xoá nhanh khi có chữ. `className` đi thẳng vào <input> để mỗi trang giữ
 * cỡ/bo góc riêng; độ rộng do nơi gọi bọc ngoài. Không có label hiển thị nên lấy
 * placeholder làm tên cho trình đọc màn hình nếu nơi gọi không truyền aria-label.
 */
export default function SearchInput({ value, onChange, className, ...props }: SearchInputProps) {
  return (
    <div className="relative">
      <Input
        icon={<IconSearch width={16} height={16} />}
        aria-label={props['aria-label'] ?? props.placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        // Có chữ = đang lọc → viền xanh như SelectMenu (khi đang gõ vẫn là viền focus charcoal)
        className={cn('pr-9', value && 'border-accent-600', className)}
        {...props}
      />
      {value && (
        <button
          type="button"
          aria-label="Xoá nội dung tìm kiếm"
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-sm leading-none text-warmGray hover:bg-warmGray/15 hover:text-charcoal"
        >
          ×
        </button>
      )}
    </div>
  )
}

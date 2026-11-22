import type { InputHTMLAttributes } from 'react'
import { Input } from '@/components/ui/Input'
import { IconSearch } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import { t, tr } from '@/i18n'

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string
  onChange: (value: string) => void
}

// Ô tìm kiếm; không truyền aria-label thì lấy placeholder
export default function SearchInput({ value, onChange, className, ...props }: SearchInputProps) {
  return (
    <div className="relative">
      <Input
        icon={<IconSearch width={16} height={16} />}
        aria-label={tr(props['aria-label'] ?? props.placeholder)}
        value={value}
        onChange={e => onChange(e.target.value)}
        // Có chữ = đang lọc → viền xanh như SelectMenu (khi đang gõ vẫn là viền focus charcoal)
        className={cn('pr-9 max-sm:py-3', value && 'border-accent-600', className)}
        {...props}
      />
      {value && (
        <button
          type="button"
          aria-label={t('Xoá nội dung tìm kiếm')}
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-sm leading-none text-warmGray hover:bg-warmGray/15 hover:text-charcoal"
        >
          ×
        </button>
      )}
    </div>
  )
}

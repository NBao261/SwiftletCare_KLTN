import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/cn'

/**
 * Button — bám đúng "Bảng Phân Loại Màu Nút Bấm Mặc Định" (FE_Design_Claude.md §5.1)
 *
 *   primary   Charcoal bg / White text     — hành động chính duy nhất trên màn hình
 *   accent    Lime Mist bg / Charcoal text — kích hoạt đặc biệt, badge nổi bật
 *   secondary White bg / Charcoal text     — nút hủy, nút phụ cạnh primary
 *   climate   Climate Orange bg / White    — chế độ vi khí hậu, bật thiết bị sưởi/thông gió
 *   danger    Alert Red bg / White         — hành động khẩn cấp / phá hủy
 *   icon      White bg, bo tròn, chỉ icon  — nút quay lại, menu, thêm, chuông
 *
 * Disabled tự động áp dụng qua thuộc tính HTML `disabled` (§2.3 hàng "Disabled").
 */
type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'climate' | 'danger' | 'icon'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:   'bg-charcoal text-white hover:bg-charcoal/90',
  accent:    'bg-limeMist text-charcoal hover:bg-limeMist/80 font-bold',
  secondary: 'bg-white text-charcoal border border-warmGray/15 hover:bg-warmGray/10',
  climate:   'bg-climateOrange text-white hover:bg-climateOrange/90',
  danger:    'bg-alertRed text-white hover:bg-alertRed/90',
  icon:      'bg-white text-charcoal border border-warmGray/10 shadow-icon hover:bg-warmGray/10',
}

const SIZE_CLASS: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-12 px-5 text-sm',
  lg: 'h-14 px-6 text-base',
}

const ICON_SIZE_CLASS: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-9 w-9',
  md: 'h-11 w-11',
  lg: 'h-12 w-12',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, disabled, className, children, ...props }, ref) => {
    const isIcon = variant === 'icon'
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors',
          'disabled:cursor-not-allowed disabled:bg-warmGray/20 disabled:text-warmGray disabled:border-transparent disabled:hover:bg-warmGray/20',
          isIcon ? ICON_SIZE_CLASS[size] : SIZE_CLASS[size],
          !disabled && !loading && VARIANT_CLASS[variant],
          className,
        )}
        {...props}
      >
        {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : children}
      </button>
    )
  },
)
Button.displayName = 'Button'

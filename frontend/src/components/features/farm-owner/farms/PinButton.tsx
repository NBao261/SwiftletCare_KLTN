import { StarIcon } from '@phosphor-icons/react'
import { useT } from '@/hooks/common/useT'
import { farmDict } from '@/constants/farmStructure.i18n'
import { cn } from '@/lib/cn'

interface PinButtonProps {
  pinned: boolean
  onToggle: () => void
}

/** Nút sao ghim nhà yến lên đầu danh sách — không kích hoạt thao tác của hàng/card chứa nó */
export default function PinButton({ pinned, onToggle }: PinButtonProps) {
  const { t } = useT(farmDict)
  const label = t(pinned ? 'pin.unpin' : 'pin.pin')
  return (
    <button
      type="button"
      aria-pressed={pinned}
      aria-label={label}
      title={label}
      onClick={e => { e.stopPropagation(); onToggle() }}
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-warmGray/10',
        pinned ? 'text-charcoal' : 'text-warmGray',
      )}
    >
      <StarIcon size={18} weight={pinned ? 'fill' : 'regular'} />
    </button>
  )
}

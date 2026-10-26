import type { KeyboardEvent, ReactNode } from 'react'
import { CaretDownIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react'
import { Badge, Button } from '@/components/ui'
import { CAPSULE_ACTION_CLASS } from '@/components/features/farm-owner/farms/farmStructure.constants'
import { NO_VALUE } from '@/constants/display'
import { farmDict } from '@/constants/farmStructure.i18n'
import { useTranslation } from '@/hooks/common/useTranslation'
import { cn } from '@/lib/cn'
import type { Farm } from '@/types'

interface FarmGroupRowProps {
  farm: Farm
  houseCount: number
  deviceCount: number
  alertHouseCount: number
  isExpanded: boolean
  // Chủ chính: được xoá farm
  isPrimary: boolean
  canEdit: boolean
  canAddHouse: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  onAddHouse: () => void
  // Các nhà yến của farm, chỉ hiện khi đang xổ
  children: ReactNode
}

// 1 hàng trang trại trên trang Trang trại: bấm hàng để xổ / thu các nhà yến bên trong, nút Sửa / Xoá / Thêm nhà ngay trên hàng
export default function FarmGroupRow({
  farm, houseCount, deviceCount, alertHouseCount, isExpanded, isPrimary, canEdit, canAddHouse,
  onToggle, onEdit, onDelete, onAddHouse, children,
}: FarmGroupRowProps) {
  const { t, num } = useTranslation(farmDict)
  const hasDevices = deviceCount > 0

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    onToggle()
  }

  return (
    // Đang xổ: viền xanh chanh ôm cả hàng farm lẫn phần xổ, giống bảng nhà yến ở trang Thiết bị
    <div className={cn('border-t border-warmGray/10 first:rounded-t-2xl first:border-t-0 last:rounded-b-2xl', isExpanded && 'outline outline-2 -outline-offset-2 outline-accent-600')}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={t(isExpanded ? 'farmGroup.collapse' : 'farmGroup.expand', { name: farm.name })}
        onClick={onToggle}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex cursor-pointer flex-wrap items-center justify-between gap-3 px-4 py-4 transition-colors [div:first-child>&]:rounded-t-2xl',
          isExpanded ? 'bg-accent-50' : 'hover:bg-warmGray/5',
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <CaretDownIcon size={16} weight="bold" className={cn('shrink-0 text-graphite transition-transform duration-200', isExpanded && 'rotate-180')} />
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-semibold text-charcoal">
              <span className="truncate">{farm.name}</span>
              {isPrimary && <Badge tone="neutral">{t('manage.primary')}</Badge>}
            </p>
            <p className="truncate text-xs text-warmGray">{farm.address || NO_VALUE}</p>
            {!farm.coordinates && <p className="text-xs text-climateOrange">{t('farmForm.noLocation')}</p>}
            <p className="text-xs text-warmGray">
              {t('manage.stats', { houses: num(houseCount), devices: num(deviceCount) })}
              {alertHouseCount > 0 && <span className="text-climateOrange"> · {t('farmGroup.alertHouses', { n: num(alertHouseCount) })}</span>}
            </p>
          </div>
        </div>

        {/* Nút trên hàng: bấm không xổ / thu hàng */}
        <div className="flex flex-wrap items-center gap-2 pl-7 md:pl-0" onClick={event => event.stopPropagation()}>
          {canAddHouse && (
            <Button variant="secondary" size="sm" className={cn('h-9 text-xs', CAPSULE_ACTION_CLASS)} onClick={onAddHouse}>
              <PlusIcon size={14} weight="bold" />
              {t('farmGroup.addHouse')}
            </Button>
          )}
          {canEdit && (
            <Button variant="secondary" size="sm" className={cn('h-9 text-xs', CAPSULE_ACTION_CLASS)} onClick={onEdit}>
              <PencilSimpleIcon size={14} weight="bold" />
              {t('manage.edit')}
            </Button>
          )}
          {canEdit && isPrimary && (
            <Button
              variant="secondary"
              size="sm"
              className={cn('h-9 text-xs', CAPSULE_ACTION_CLASS)}
              disabled={hasDevices}
              title={hasDevices ? t('manage.deleteBlocked', { n: num(deviceCount) }) : undefined}
              onClick={onDelete}
            >
              <TrashIcon size={14} weight="bold" />
              {t('manage.delete')}
            </Button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="flex flex-col gap-4 border-t border-warmGray/10 bg-warmGray/5 px-4 py-4">
          {canEdit && isPrimary && hasDevices && <p className="text-xs text-warmGray">{t('manage.deleteBlocked', { n: num(deviceCount) })}</p>}
          {houseCount === 0 ? <p className="text-sm text-warmGray">{t('farmGroup.noHouse')}</p> : children}
        </div>
      )}
    </div>
  )
}

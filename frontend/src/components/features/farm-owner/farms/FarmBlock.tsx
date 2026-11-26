import type { ReactNode } from 'react'
import { PlusIcon } from '@phosphor-icons/react'
import { ActionsMenu, Badge, Button, SectionCard, type ActionsMenuItem } from '@/components/ui'
import { NO_VALUE } from '@/constants/display'
import { farmDict } from '@/constants/farmStructure.i18n'
import { useTranslation } from '@/hooks/common/useTranslation'
import type { Farm } from '@/types'

interface FarmBlockProps {
  farm: Farm
  houseCount: number
  deviceCount: number
  // Chủ chính: được xoá farm
  isPrimary: boolean
  canEdit: boolean
  canAddHouse: boolean
  onEdit: () => void
  onDelete: () => void
  onAddHouse: () => void
  // có thì hiện mục "Áp hồ sơ" (Farm Owner, farm đã có nhà)
  onApplyProfile?: () => void
  // Bảng nhà yến của farm
  children: ReactNode
}

// 1 trang trại là 1 thẻ: tên, địa chỉ, nút thêm nhà và menu sửa / xoá ở đầu thẻ, bảng nhà yến ngay dưới
export default function FarmBlock({
  farm, houseCount, deviceCount, isPrimary, canEdit, canAddHouse, onEdit, onDelete, onAddHouse, onApplyProfile, children,
}: FarmBlockProps) {
  const { t, num } = useTranslation(farmDict)
  const hasDevices = deviceCount > 0
  // Xoá bị khoá khi còn thiết bị: lý do ghi ngay dưới mục trong menu
  const menuItems: ActionsMenuItem[] = []
  if (onApplyProfile) menuItems.push({ label: t('profile.apply'), onClick: onApplyProfile })
  if (canEdit) menuItems.push({ label: t('manage.edit'), onClick: onEdit })
  if (canEdit && isPrimary) {
    const hint = hasDevices ? t('manage.deleteBlocked', { n: num(deviceCount) }) : undefined
    menuItems.push({ label: t('manage.delete'), onClick: onDelete, danger: true, disabled: hasDevices, hint })
  }

  return (
    <SectionCard
      title={<>{farm.name}{isPrimary && <Badge tone="neutral">{t('manage.primary')}</Badge>}</>}
      description={farm.coordinates ? (farm.address || NO_VALUE) : <>{farm.address || NO_VALUE}<span className="text-climateOrange"> · {t('farmForm.noLocation')}</span></>}
      action={(canAddHouse || menuItems.length > 0) && (
        <div className="flex items-center gap-2">
          {canAddHouse && (
            <Button variant="secondary" size="sm" onClick={onAddHouse}>
              <PlusIcon size={14} weight="bold" />
              {t('farmGroup.addHouse')}
            </Button>
          )}
          {menuItems.length > 0 && <ActionsMenu items={menuItems} />}
        </div>
      )}
    >
      {houseCount === 0 ? <p className="rounded-xl border border-dashed border-warmGray/30 px-4 py-6 text-center text-sm text-warmGray">{t('farmGroup.noHouse')}</p> : children}
    </SectionCard>
  )
}

import { useState } from 'react'
import { InfoIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { Button, Input, Modal } from '@/components/ui'
import { farmDict } from '@/constants/farmStructure.i18n'
import { useTranslation } from '@/hooks/common/useTranslation'
import { isNameTaken } from '@/components/features/farm-owner/farms/farmStructure'

interface StructureEditModalProps {
  kind: 'house' | 'zone'
  mode: 'rename' | 'delete'
  name: string
  // Tên các nhà / Zone cùng cấp — không cho đổi sang tên đã có
  existingNames?: string[]
  // Số thiết bị đang lắp trong nhà / Zone — còn thiết bị thì chặn xoá
  deviceCount: number
  onClose: () => void
}

// Đổi tên / xoá nhà yến hoặc Zone: dựng sẵn, nút khoá tới khi swagger có PUT/DELETE House, Zone (giữ chặn xoá khi còn thiết bị)
export default function StructureEditModal({ kind, mode, name, deviceCount, existingNames = [], onClose }: StructureEditModalProps) {
  const { t, num } = useTranslation(farmDict)
  const [newName, setNewName] = useState(name)
  const target = t(kind === 'house' ? 'structure.house' : 'structure.zone')
  const isDeleteBlocked = mode === 'delete' && deviceCount > 0
  const isDuplicate = mode === 'rename' && isNameTaken(newName, existingNames, name)

  return (
    <Modal
      open
      onClose={onClose}
      title={t(mode === 'rename' ? 'structure.renameTitle' : 'structure.deleteTitle', { target, name })}
    >
      <div className="flex flex-col gap-4">
        {mode === 'rename' && (
          <Input
            label={t('structure.newName')}
            value={newName}
            onChange={event => setNewName(event.target.value)}
            error={isDuplicate ? t('structure.errorDuplicate', { target }) : undefined}
          />
        )}
        {mode === 'delete' && !isDeleteBlocked && <p className="text-sm text-charcoal">{t('structure.deleteDesc', { target })}</p>}
        {isDeleteBlocked && (
          <p className="flex items-start gap-2 rounded-2xl border-2 border-orange-300 bg-orange-50 px-3 py-2.5 text-sm text-charcoal">
            <WarningCircleIcon size={18} weight="bold" className="mt-0.5 shrink-0 text-safetyOrange" />
            {t('structure.deleteBlocked', { target, n: num(deviceCount) })}
          </p>
        )}
        {/* Backend chưa có API sửa / xoá nhà, Zone nên nút xác nhận khoá */}
        <p className="flex items-start gap-2 rounded-2xl bg-warmGray/10 px-3 py-2.5 text-xs text-graphite">
          <InfoIcon size={16} className="mt-0.5 shrink-0" />
          {t('structure.pendingApi')}
        </p>
        <div className="flex justify-end gap-2 border-t border-warmGray/10 pt-4">
          <Button type="button" variant="secondary" className="min-w-[8rem]" onClick={onClose}>{t('structure.cancel')}</Button>
          <Button type="button" className="min-w-[8rem]" disabled>
            {t(mode === 'rename' ? 'structure.save' : 'structure.delete')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

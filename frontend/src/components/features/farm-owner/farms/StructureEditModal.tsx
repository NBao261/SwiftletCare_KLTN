import { useState } from 'react'
import { WarningCircleIcon } from '@phosphor-icons/react'
import { Button, Input, Modal } from '@/components/ui'
import { farmDict } from '@/constants/farmStructure.i18n'
import { useTranslation } from '@/hooks/common/useTranslation'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { useEditStructure } from '@/hooks/shared/useFarms'
import { isNameTaken } from '@/components/features/farm-owner/farms/farmStructure'
import { STRUCTURE_NAME_MAX_LENGTH } from '@/components/features/farm-owner/farms/farmStructure.constants'

interface StructureEditModalProps {
  kind: 'house' | 'zone'
  mode: 'rename' | 'delete'
  id: string
  name: string
  // Tên các nhà / Zone cùng cấp: không cho đổi sang tên đã có
  existingNames?: string[]
  // Số thiết bị đang lắp trong nhà / Zone: còn thiết bị thì chặn xoá
  deviceCount: number
  onClose: () => void
  // Xoá xong: trang đang mở không còn, trang gọi điều hướng về cấp trên
  onDeleted?: () => void
}

// đổi tên / xoá mềm nhà yến hoặc Zone; còn thiết bị thì chặn xoá (backend cũng trả 409 HAS_ACTIVE_DEVICES)
export default function StructureEditModal({ kind, mode, id, name, deviceCount, existingNames = [], onClose, onDeleted }: StructureEditModalProps) {
  const { t, num } = useTranslation(farmDict)
  const [newName, setNewName] = useState(name)
  const target = t(kind === 'house' ? 'structure.house' : 'structure.zone')
  const isDeleteBlocked = mode === 'delete' && deviceCount > 0
  const isDuplicate = mode === 'rename' && isNameTaken(newName, existingNames, name)
  const apiErrorMessage = useApiErrorMessage()
  const { rename, remove } = useEditStructure()
  const mutation = mode === 'rename' ? rename : remove
  const trimmed = newName.trim()
  const canSubmit = mode === 'rename' ? trimmed !== '' && trimmed !== name && !isDuplicate : !isDeleteBlocked
  // mutateAsync: nơi xoá gỡ modal trước khi callback của mutate chạy
  async function handleSubmit() {
    try {
      if (mode === 'rename') await rename.mutateAsync({ kind, id, name: trimmed })
      else await remove.mutateAsync({ kind, id })
    } catch {
      return // lỗi hiện ngay trong modal
    }
    onClose()
    if (mode === 'delete') onDeleted?.()
  }
  // Backend còn đếm cả camera và thiết bị web chưa thấy: nói đúng lý do thay vì câu chung "dữ liệu không hợp lệ"
  const errorCode = (mutation.error as { response?: { data?: { error?: { code?: string } } } } | null)?.response?.data?.error?.code
  const errorText = errorCode === 'HAS_ACTIVE_DEVICES' ? t('structure.deleteBlockedServer', { target }) : apiErrorMessage(mutation.error)

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
            maxLength={STRUCTURE_NAME_MAX_LENGTH}
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
        {mutation.isError && <p role="alert" className="text-sm text-alertRed">{errorText}</p>}
        <div className="flex justify-end gap-2 border-t border-warmGray/10 pt-4">
          <Button type="button" variant="secondary" className="min-w-[8rem]" onClick={onClose}>{t('structure.cancel')}</Button>
          <Button
            type="button"
            className="min-w-[8rem]"
            variant={mode === 'delete' ? 'danger' : undefined}
            disabled={!canSubmit || mutation.isPending}
            onClick={() => void handleSubmit()}
          >
            {mode === 'rename' ? t('structure.save') : t('structure.delete', { target })}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

import { useEffect, useState, type FormEvent } from 'react'
import { Button, Input, Modal, ModalHeader, SelectMenu } from '@/components/ui'
import { useAddStockDevice } from '@/hooks/admin/useDeviceStock'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { useToastStore } from '@/stores/toastStore'
import { t } from '@/i18n'
import { deviceIdError } from '@/validations/common/deviceId.validation'
import type { IssuedDeviceSecrets, ProvisionedDeviceKind } from '@/types'


const KIND_OPTIONS: { value: ProvisionedDeviceKind; label: string }[] = [
  { value: 'SENSOR', label: 'Bộ điều khiển' },
  { value: 'CAMERA', label: 'Camera đếm chim' },
]

const validate = (deviceId: string): string | undefined => {
  const problem = deviceIdError(deviceId)
  return problem && t(problem)
}

// thêm thiết bị vào kho; thành công thì trả mã (chỉ 1 lần) cho trang mở popup in nhãn
export default function AddStockDeviceModal({ open, onClose, onAdded }: {
  open: boolean; onClose: () => void; onAdded: (issued: IssuedDeviceSecrets) => void
}) {
  const add = useAddStockDevice()
  const push = useToastStore(s => s.push)
  const apiErrorMessage = useApiErrorMessage()
  const [deviceId, setDeviceId] = useState('')
  const [kind, setKind] = useState<ProvisionedDeviceKind>('SENSOR')
  const [touched, setTouched] = useState(false)
  // Mã backend vừa báo trùng (409), báo ngay ở ô nhập tới khi đổi mã
  const [duplicateId, setDuplicateId] = useState('')

  useEffect(() => { if (open) { setDeviceId(''); setKind('SENSOR'); setTouched(false); setDuplicateId('') } }, [open])

  const duplicateError = duplicateId && deviceId.trim() === duplicateId ? t('Mã thiết bị đã có trong kho') : undefined
  const error = touched ? validate(deviceId) ?? duplicateError : undefined

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (validate(deviceId)) return
    add.mutate({ device_id: deviceId.trim(), kind }, {
      onSuccess: onAdded,
      onError: err => {
        const status = (err as { response?: { status?: number } }).response?.status
        if (status === 409) setDuplicateId(deviceId.trim())
        else push(apiErrorMessage(err, t('Thêm thiết bị thất bại')), 'error')
      },
    })
  }

  const title = t('Thêm thiết bị vào kho')
  return (
    <Modal open={open} onClose={onClose} size="lg" ariaLabel={title}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <ModalHeader title={title} description="Mã kích hoạt và mật khẩu kết nối chỉ hiện một lần, ngay sau khi thêm" />
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2">
          <Input
            label="Mã thiết bị"
            required
            autoComplete="off"
            placeholder="VD: node_101"
            value={deviceId}
            onChange={e => setDeviceId(e.target.value)}
            onBlur={() => setTouched(true)}
            error={error}
          />
          <div className="flex flex-col gap-1.5">
            <span className="label-caption">{t('Loại')}</span>
            <SelectMenu
              field
              highlightFiltered={false}
              ariaLabel={t('Loại')}
              value={kind}
              options={KIND_OPTIONS}
              onChange={setKind}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={add.isPending}>Thêm và in nhãn</Button>
        </div>
      </form>
    </Modal>
  )
}

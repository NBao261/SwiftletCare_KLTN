import { useState } from 'react'
import { UploadSimpleIcon } from '@phosphor-icons/react'
import { Button, Input } from '@/components/ui'
import { useUploadFirmwareImage } from '@/hooks/admin/useFirmwareImages'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { detectFirmwareVersion } from '@/lib/firmwareFlasher'
import { useToastStore } from '@/stores/toastStore'
import { t } from '@/i18n'
import type { FirmwareImage } from '@/types'

const VERSION_PATTERN = /^\d+\.\d+\.\d+$/

// Tải ảnh cài đặt lên kho firmware: chỉ ở trang Cập nhật firmware; thẻ Kho firmware ở Kho thiết bị chỉ liệt kê và xoá
export default function FirmwareUploadForm({ onUploaded }: { onUploaded?: (image: FirmwareImage) => void }) {
  const upload = useUploadFirmwareImage()
  const push = useToastStore(s => s.push)
  const apiErrorMessage = useApiErrorMessage()

  const [version, setVersion] = useState('')
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileInputKey, setFileInputKey] = useState(0)

  const trimmedVersion = version.trim()
  const versionError = trimmedVersion && !VERSION_PATTERN.test(trimmedVersion) ? t('Phiên bản có dạng 2.4.0') : undefined
  const canUpload = Boolean(trimmedVersion && !versionError && file)

  // Đọc phiên bản trong file để khỏi gõ nhầm; không thấy thì để Administrator gõ, backend vẫn kiểm lại
  async function pickFile(picked: File | null) {
    setFile(picked)
    if (!picked) return
    const detected = detectFirmwareVersion(new Uint8Array(await picked.arrayBuffer()))
    if (detected) setVersion(detected)
  }

  function submit() {
    if (!file || !canUpload) return
    upload.mutate({ version: trimmedVersion, note: note.trim() || undefined, file }, {
      onSuccess: image => {
        push(t('Đã tải lên firmware {{version}}', { version: image.version }))
        setVersion(''); setNote(''); setFile(null); setFileInputKey(key => key + 1)
        onUploaded?.(image)
      },
      onError: err => push(apiErrorMessage(err, t('Tải lên thất bại')), 'error'),
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          key={fileInputKey}
          type="file"
          accept=".bin,application/octet-stream"
          aria-label={t('File factory.bin')}
          className="min-w-0 flex-1 text-sm text-charcoal file:mr-3 file:rounded-xl file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-semibold"
          onChange={event => void pickFile(event.target.files?.[0] ?? null)}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <Input
          label="Phiên bản"
          placeholder="2.4.0"
          value={version}
          onChange={event => setVersion(event.target.value)}
          error={versionError}
        />
        <Input label="Ghi chú" placeholder="VD: sửa lỗi kết nối lại" maxLength={200} value={note} onChange={event => setNote(event.target.value)} />
      </div>
      <Button className="self-end" onClick={submit} disabled={!canUpload} loading={upload.isPending}>
        <UploadSimpleIcon size={14} weight="bold" aria-hidden />{t('Tải lên')}
      </Button>
    </div>
  )
}

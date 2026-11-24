import { useState } from 'react'
import { CpuIcon, TrashIcon, UploadSimpleIcon } from '@phosphor-icons/react'
import { Button, ConfirmModal, Input, SectionCard } from '@/components/ui'
import { useDeleteFirmwareImage, useFirmwareImages, useUploadFirmwareImage } from '@/hooks/admin/useFirmwareImages'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { formatDateOnly } from '@/lib/helpers'
import { useToastStore } from '@/stores/toastStore'
import { t } from '@/i18n'
import type { FirmwareImage } from '@/types'

const VERSION_PATTERN = /^\d+\.\d+\.\d+$/

const formatSize = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`

// Firmware cho trạm nạp: ảnh cài đặt dựng sẵn, trạm nạp dùng bản mới nhất cho bo trắng hoặc firmware cũ
export default function FirmwareImagesCard() {
  const { data: images } = useFirmwareImages()
  const upload = useUploadFirmwareImage()
  const remove = useDeleteFirmwareImage()
  const push = useToastStore(s => s.push)
  const apiErrorMessage = useApiErrorMessage()

  const [version, setVersion] = useState('')
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileInputKey, setFileInputKey] = useState(0)
  const [deleting, setDeleting] = useState<FirmwareImage | null>(null)

  const trimmedVersion = version.trim()
  const versionError = trimmedVersion && !VERSION_PATTERN.test(trimmedVersion) ? t('Phiên bản có dạng 2.4.0') : undefined
  const canUpload = Boolean(trimmedVersion && !versionError && file)

  function submit() {
    if (!file || !canUpload) return
    upload.mutate({ version: trimmedVersion, note: note.trim() || undefined, file }, {
      onSuccess: () => {
        push(t('Đã tải lên firmware {{version}}', { version: trimmedVersion }))
        setVersion(''); setNote(''); setFile(null); setFileInputKey(key => key + 1)
      },
      onError: err => push(apiErrorMessage(err, t('Tải lên thất bại')), 'error'),
    })
  }

  function confirmDelete() {
    if (!deleting) return
    remove.mutate(deleting._id, {
      onSuccess: () => { push(t('Đã xoá firmware {{version}}', { version: deleting.version })); setDeleting(null) },
      onError: err => push(apiErrorMessage(err, t('Thao tác thất bại')), 'error'),
    })
  }

  return (
    <SectionCard
      icon={<CpuIcon size={20} aria-hidden />}
      title="Firmware cho trạm nạp"
      description="Trạm nạp dùng bản mới nhất cho bo chưa có firmware hoặc có firmware cũ"
      help="Dựng ảnh cài đặt factory.bin theo hướng dẫn trong firmware/README.md rồi tải lên đây. Nạp firmware giữ nguyên mã và Wi-Fi đã có trên bo."
    >
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <Input label="Phiên bản" placeholder="2.4.0" value={version} onChange={event => setVersion(event.target.value)} error={versionError} />
        <Input label="Ghi chú" placeholder="VD: sửa lỗi kết nối lại" maxLength={200} value={note} onChange={event => setNote(event.target.value)} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          key={fileInputKey}
          type="file"
          accept=".bin,application/octet-stream"
          aria-label={t('File factory.bin')}
          className="min-w-0 flex-1 text-sm text-charcoal file:mr-3 file:rounded-xl file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-semibold"
          onChange={event => setFile(event.target.files?.[0] ?? null)}
        />
        <Button onClick={submit} disabled={!canUpload} loading={upload.isPending}>
          <UploadSimpleIcon size={14} weight="bold" aria-hidden />{t('Tải lên')}
        </Button>
      </div>

      {images && images.length > 0 ? (
        <ul className="divide-y divide-gray-200 rounded-2xl border border-gray-200">
          {images.map((image, index) => (
            <li key={image._id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="flex min-w-0 flex-col">
                <span className="font-semibold text-charcoal">
                  {image.version}{index === 0 && <span className="ml-2 text-xs font-normal text-accent-600">{t('Đang dùng')}</span>}
                </span>
                <span className="text-xs text-warmGray">
                  {formatSize(image.size)} · {formatDateOnly(image.created_at)}{image.note ? ` · ${image.note}` : ''}
                </span>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setDeleting(image)} aria-label={t('Xoá firmware {{version}}', { version: image.version })}>
                <TrashIcon size={14} aria-hidden />{t('Xoá')}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-warmGray">{t('Chưa có firmware nào. Trạm nạp chỉ ghi mã vào bo đã có firmware từ 2.4.0.')}</p>
      )}

      <ConfirmModal
        open={deleting !== null}
        title={deleting ? t('Xoá firmware {{version}}?', { version: deleting.version }) : ''}
        description="Trạm nạp chuyển sang bản mới nhất còn lại. Bo đã nạp không bị ảnh hưởng."
        confirmLabel="Xoá"
        danger
        loading={remove.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </SectionCard>
  )
}

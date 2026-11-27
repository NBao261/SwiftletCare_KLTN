import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRightIcon, CpuIcon, TrashIcon } from '@phosphor-icons/react'
import { Button, ConfirmModal, LoadingSkeleton, SectionCard } from '@/components/ui'
import { useDeleteFirmwareImage, useFirmwareImages } from '@/hooks/admin/useFirmwareImages'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { formatStandardDate } from '@/lib/i18n'
import { useToastStore } from '@/stores/toastStore'
import { t } from '@/i18n'
import type { FirmwareImage } from '@/types'

const formatSize = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`

// Kho firmware: ảnh cài đặt dựng sẵn, trạm nạp USB và đợt cập nhật từ xa cùng lấy từ đây; tải bản mới lên ở trang Cập nhật firmware
export default function FirmwareImagesCard() {
  const { data: images, isLoading, isError, refetch } = useFirmwareImages()
  const remove = useDeleteFirmwareImage()
  const push = useToastStore(s => s.push)
  const apiErrorMessage = useApiErrorMessage()
  const [deleting, setDeleting] = useState<FirmwareImage | null>(null)

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
      title="Kho firmware"
      description="Dùng cho trạm nạp USB và cập nhật từ xa. Bản mới nhất được dùng trước"
      help="Dựng ảnh cài đặt factory.bin theo hướng dẫn trong firmware/README.md rồi tải lên ở trang Cập nhật firmware, phiên bản được đọc sẵn từ file. Nạp qua USB giữ nguyên mã và Wi-Fi đã có trên bo."
      action={
        <Link to="/ota" className="group inline-flex items-center gap-1 text-small font-semibold text-charcoal hover:underline">
          {t('Tải bản mới lên')}
          <ArrowRightIcon size={14} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      }
    >

      {isLoading && <LoadingSkeleton count={2} className="h-14 w-full" />}
      {isError && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-warmGray">
          {t('Không tải được kho firmware. Kiểm tra kết nối tới máy chủ rồi thử lại.')}
          <Button variant="secondary" size="sm" onClick={() => refetch()}>{t('Thử lại')}</Button>
        </div>
      )}
      {images && images.length > 0 && (
        <ul className="divide-y divide-gray-200 rounded-2xl border border-gray-200">
          {images.map((image, index) => (
            <li key={image._id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="flex min-w-0 flex-col">
                <span className="font-semibold text-charcoal">
                  {image.version}{index === 0 && <span className="ml-2 text-xs font-normal text-accent-600">{t('Mới nhất')}</span>}
                </span>
                <span className="text-xs text-warmGray">
                  {formatSize(image.size)} · {formatStandardDate(image.created_at)}{image.note ? ` · ${image.note}` : ''}
                </span>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setDeleting(image)} aria-label={t('Xoá firmware {{version}}', { version: image.version })}>
                <TrashIcon size={14} aria-hidden />{t('Xoá')}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {images && images.length === 0 && (
        <p className="text-sm text-warmGray">{t('Chưa có firmware nào. Tải bản đầu tiên lên ở trang Cập nhật firmware. Khi chưa có, trạm nạp chỉ ghi mã vào bo đã có firmware từ 2.4.0.')}</p>
      )}

      <ConfirmModal
        open={deleting !== null}
        title={deleting ? t('Xoá firmware {{version}}?', { version: deleting.version }) : ''}
        description="Trạm nạp chuyển sang bản mới nhất còn lại. Bo đã nạp hay đã cập nhật không bị ảnh hưởng."
        confirmLabel="Xoá"
        danger
        loading={remove.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </SectionCard>
  )
}

import { useEffect, useState } from 'react'
import { CopyIcon, KeyIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { Button, Modal, ModalHeader } from '@/components/ui'
import { useIssueSetupCode } from '@/hooks/admin/useDeviceStock'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { useToastStore } from '@/stores/toastStore'
import { t } from '@/i18n'
import type { ProvisionedDevice } from '@/types'

// Địa chỉ API mà nút AI gọi: cùng tên miền với trang này (Nginx chuyển /api vào backend)
const apiBaseUrl = () => `${window.location.origin}/api`

function remaining(expiresAt: string, now: number): string {
  const seconds = Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

// Mã cài đặt camera đếm chim (FARM-FR-010): dùng một lần, 30 phút; máy nút AI chạy tools/setup_node.py rồi nhập mã
export default function AiNodeSetupModal({ device, onClose }: { device: ProvisionedDevice | null; onClose: () => void }) {
  const issue = useIssueSetupCode()
  const apiErrorMessage = useApiErrorMessage()
  const push = useToastStore(s => s.push)
  const [now, setNow] = useState(Date.now())

  useEffect(() => { if (!device) issue.reset() }, [device]) // eslint-disable-line react-hooks/exhaustive-deps -- đóng thì xoá mã đang hiện
  useEffect(() => {
    if (!issue.data) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [issue.data])

  const code = issue.data
  const expired = code ? new Date(code.expires_at).getTime() <= now : false
  const command = `python tools/setup_node.py --server ${apiBaseUrl()}`

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      push(t('Đã chép'))
    } catch {
      push(t('Không chép được, hãy bôi đen rồi chép tay'), 'error')
    }
  }

  const title = t('Mã cài đặt camera đếm chim {{id}}', { id: device?.device_id ?? '' })
  return (
    <Modal open={!!device} onClose={onClose} size="lg" ariaLabel={title}>
      <div className="flex flex-col gap-5">
        <ModalHeader title={title} description="Máy chạy phần mềm đếm chim dùng mã này để tự nhận mã thiết bị và mật khẩu kết nối, không ai phải chép mật khẩu." />

        {device?.stock_status === 'IN_SERVICE' && (
          <p className="flex items-start gap-2 rounded-2xl bg-orange-50 p-4 text-sm text-orange-700">
            <WarningCircleIcon size={18} className="mt-0.5 shrink-0" aria-hidden />
            {t('Camera này đang dùng. Máy nào nhập mã sẽ thay máy đếm chim đang chạy, máy cũ bị ngắt kết nối.')}
          </p>
        )}

        {!code ? (
          <Button className="self-start" loading={issue.isPending}
            onClick={() => device && issue.mutate(device._id, { onError: err => push(apiErrorMessage(err, t('Không tạo được mã cài đặt')), 'error') })}>
            <KeyIcon size={16} aria-hidden />{t('Tạo mã cài đặt')}
          </Button>
        ) : (
          <section className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`font-mono text-3xl font-bold tracking-widest ${expired ? 'text-warmGray line-through' : 'text-charcoal'}`}>{code.setup_code}</span>
              <Button variant="secondary" size="sm" onClick={() => void copy(code.setup_code)} disabled={expired}>
                <CopyIcon size={14} aria-hidden />{t('Chép mã')}
              </Button>
              <span className="text-sm text-warmGray" aria-live="polite">
                {expired ? t('Mã đã hết hạn') : t('Còn {{time}}, dùng một lần', { time: remaining(code.expires_at, now) })}
              </span>
            </div>
            {expired && (
              <Button variant="secondary" size="sm" className="self-start" loading={issue.isPending} onClick={() => device && issue.mutate(device._id)}>
                {t('Tạo mã mới')}
              </Button>
            )}
            <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-charcoal">
              <li>{t('Trên máy chạy phần mềm đếm chim, mở thư mục ai-pipeline và chạy lệnh:')}
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <code className="rounded-lg bg-white px-2 py-1 font-mono text-xs">{command}</code>
                  <Button variant="secondary" size="sm" onClick={() => void copy(command)}><CopyIcon size={14} aria-hidden />{t('Chép lệnh')}</Button>
                </div>
              </li>
              <li>{t('Nhập mã ở trên khi được hỏi. Công cụ tự ghi danh tính và thử kết nối.')}</li>
              <li>{t('Chủ nhà yến gắn camera vào nhà bằng nhãn và nhập địa chỉ camera ở trang Thiết bị.')}</li>
            </ol>
          </section>
        )}

        <Button variant="secondary" className="self-end" onClick={onClose}>{t('Đóng')}</Button>
      </div>
    </Modal>
  )
}

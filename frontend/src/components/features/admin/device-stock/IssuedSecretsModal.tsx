import { useEffect, useState } from 'react'
import { Button, Modal, ModalHeader } from '@/components/ui'
import { deviceLabelCode, printQrLabels, qrDataUrl } from '@/lib/qrCode'
import { useToastStore } from '@/stores/toastStore'
import { t } from '@/i18n'
import type { IssuedDeviceSecrets } from '@/types'

/**
 * FARM-FR-010 — mã vừa cấp, hiện đúng 1 lần (backend chỉ lưu hash). Mã kích hoạt → nhãn QR để in và dán lên
 * thiết bị; mật khẩu broker → chép để flash cùng device ID (`firmware/tools/flash_identity.py`), không in lên nhãn.
 */
export default function IssuedSecretsModal({ issued, onClose }: { issued: IssuedDeviceSecrets | null; onClose: () => void }) {
  const push = useToastStore(s => s.push)
  const [qr, setQr] = useState<string>()
  const key = issued?.secret_key
  const code = issued && key ? deviceLabelCode(issued.device_id, key) : undefined

  useEffect(() => {
    setQr(undefined)
    if (code) void qrDataUrl(code).then(setQr)
  }, [code])

  if (!issued) return null

  function print() {
    if (!issued || !key || !code) return
    void printQrLabels(issued.device_id, [{
      code,
      lines: [
        { text: 'SwiftletCare', strong: true },
        { text: t('Mã thiết bị') },
        { text: issued.device_id, mono: true },
        { text: t('Mã kích hoạt') },
        { text: key, mono: true },
      ],
    }])
  }

  function copy(value: string) {
    navigator.clipboard.writeText(value).then(
      () => push(t('Đã chép mật khẩu broker')),
      () => push(t('Không chép được — hãy chọn và chép tay'), 'error'),
    )
  }

  const title = t('Mã của {{id}}', { id: issued.device_id })
  return (
    <Modal open onClose={onClose} size="lg" ariaLabel={title}>
      <div className="flex flex-col gap-5">
        <ModalHeader title={title} description="Chỉ hiện một lần — đóng popup là không xem lại được, chỉ cấp lại được mã mới" />

        {key && (
          <section className="flex flex-col gap-3">
            <h3 className="text-body font-semibold text-charcoal">{t('Nhãn thiết bị')}</h3>
            <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              {qr
                ? <img src={qr} alt={t('Mã QR nhãn thiết bị')} className="h-28 w-28 shrink-0 rounded-lg bg-white" />
                : <div className="h-28 w-28 shrink-0 animate-pulse rounded-lg bg-gray-200" />}
              <dl className="min-w-0 text-sm">
                <dt className="text-warmGray">{t('Mã thiết bị')}</dt>
                <dd className="break-all font-mono font-bold text-charcoal">{issued.device_id}</dd>
                <dt className="mt-2 text-warmGray">{t('Mã kích hoạt')}</dt>
                <dd className="break-all font-mono font-bold text-charcoal">{key}</dd>
              </dl>
            </div>
            <p className="text-xs text-warmGray">{t('Dán nhãn lên thiết bị. Nhãn cũ (nếu có) không còn dùng được.')}</p>
            <Button variant="secondary" onClick={print} className="self-start">In nhãn</Button>
          </section>
        )}

        {issued.broker_secret && (
          <section className="flex flex-col gap-3">
            <h3 className="text-body font-semibold text-charcoal">{t('Mật khẩu broker')}</h3>
            <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <code className="min-w-0 flex-1 select-all break-all font-mono text-sm font-bold text-charcoal">{issued.broker_secret}</code>
              <Button variant="secondary" size="sm" onClick={() => copy(issued.broker_secret!)}>Sao chép</Button>
            </div>
            <p className="text-xs text-warmGray">
              {t('Nạp vào thiết bị cùng mã thiết bị bằng firmware/tools/flash_identity.py. Không in lên nhãn.')}
            </p>
          </section>
        )}

        <div className="flex justify-end border-t border-gray-200 pt-4">
          <Button onClick={onClose}>Đã lưu, đóng</Button>
        </div>
      </div>
    </Modal>
  )
}

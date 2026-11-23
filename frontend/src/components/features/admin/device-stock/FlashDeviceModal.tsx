import { useEffect, useRef, useState } from 'react'
import { CheckCircleIcon, UsbIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { Button, Input, Modal, ModalHeader } from '@/components/ui'
import { useAddStockDevice, useFindStockDevice, useRotateBrokerSecret } from '@/hooks/admin/useDeviceStock'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import {
  CHIP_ERROR_TEXT, DeviceSerial, SerialError, isWebSerialSupported, suggestDeviceId, type ChipInfo,
} from '@/lib/deviceSerial'
import { deviceLabelCode, printQrLabels, qrDataUrl } from '@/lib/qrCode'
import { t } from '@/i18n'
import type { ProvisionedDevice } from '@/types'

// Cùng mẫu backend và firmware: mã là username và một đoạn topic trên broker
const DEVICE_ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/

type Step = 'start' | 'reading' | 'ready' | 'writing' | 'done'

interface Flashed {
  deviceId: string
  mac: string
  // Chỉ có khi vừa thêm vào kho (mã kích hoạt trả đúng một lần); nạp lại thì nhãn cũ trên bo vẫn dùng
  secretKey?: string
}

function printLabel(item: Flashed): void {
  if (!item.secretKey) return
  void printQrLabels(item.deviceId, [{
    code: deviceLabelCode(item.deviceId, item.secretKey),
    lines: [
      { text: 'SwiftletCare', strong: true },
      { text: t('Mã thiết bị') },
      { text: item.deviceId, mono: true },
      { text: t('Mã kích hoạt') },
      { text: item.secretKey, mono: true },
    ],
  }])
}

// Trạm nạp ở xưởng: cắm ESP32 qua USB, đọc chip, thêm vào kho và ghi mã + mật khẩu broker thẳng vào chip, in nhãn
export default function FlashDeviceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const add = useAddStockDevice()
  const findStock = useFindStockDevice()
  const rotateBroker = useRotateBrokerSecret()
  const apiErrorMessage = useApiErrorMessage()
  const serialRef = useRef<DeviceSerial | null>(null)

  const [step, setStep] = useState<Step>('start')
  const [error, setError] = useState<string | null>(null)
  const [chip, setChip] = useState<ChipInfo | null>(null)
  const [stockEntry, setStockEntry] = useState<ProvisionedDevice | null>(null)
  const [deviceId, setDeviceId] = useState('')
  const [confirmOverwrite, setConfirmOverwrite] = useState(false)
  // Đã thêm vào kho nhưng ghi chip lỗi: nạp lại dùng đúng mục kho đó, không thêm lần nữa
  const [pending, setPending] = useState<Flashed | null>(null)
  const [last, setLast] = useState<Flashed | null>(null)
  const [session, setSession] = useState<Flashed[]>([])
  const [qr, setQr] = useState<string>()

  const supported = isWebSerialSupported()

  async function closePort(): Promise<void> {
    await serialRef.current?.close()
    serialRef.current = null
  }

  useEffect(() => {
    if (open) return
    void closePort()
    setStep('start'); setError(null); setChip(null); setStockEntry(null); setPending(null); setLast(null); setSession([])
  }, [open])

  useEffect(() => {
    setQr(undefined)
    if (last?.secretKey) void qrDataUrl(deviceLabelCode(last.deviceId, last.secretKey)).then(setQr)
  }, [last])

  async function connect(): Promise<void> {
    setError(null); setChip(null); setStockEntry(null); setConfirmOverwrite(false); setLast(null)
    await closePort()
    const serial = new DeviceSerial()
    try {
      await serial.connect()
      serialRef.current = serial
      setStep('reading')
      const info = await serial.info()
      setChip(info)
      setDeviceId(info.deviceId ?? suggestDeviceId(info.mac))
      setStockEntry(info.deviceId ? await findStock.mutateAsync(info.deviceId) : null)
      setStep('ready')
    } catch (err) {
      await serial.close()
      setStep('start')
      setError(err instanceof SerialError ? t(err.message) : apiErrorMessage(err, t('Không kết nối được bo mạch')))
    }
  }

  const trimmedId = deviceId.trim()
  const idError = trimmedId && !DEVICE_ID_PATTERN.test(trimmedId) ? t('Mã thiết bị chỉ gồm chữ, số, "_", "-", tối đa 40 ký tự') : undefined
  const isReflash = stockEntry !== null && chip?.deviceId === trimmedId
  const needsOverwrite = Boolean(chip?.deviceId)
  const canFlash = step === 'ready' && trimmedId !== '' && !idError && (!needsOverwrite || confirmOverwrite)

  async function flash(): Promise<void> {
    const serial = serialRef.current
    if (!serial || !chip || !canFlash) return
    setError(null)
    setStep('writing')
    try {
      // Mục kho có sẵn (nạp lại hoặc lần trước ghi lỗi): cấp mật khẩu broker mới; chưa có thì thêm vào kho kèm MAC
      let flashed: Flashed
      let secret: { broker_secret?: string; broker_host?: string | null }
      const retry = pending?.deviceId === trimmedId ? pending : null
      if (isReflash || retry) {
        const entry = isReflash ? stockEntry : await findStock.mutateAsync(trimmedId)
        if (!entry) throw new Error(t('Không tìm thấy {{id}} trong kho', { id: trimmedId }))
        secret = await rotateBroker.mutateAsync(entry._id)
        flashed = { deviceId: trimmedId, mac: chip.mac, secretKey: retry?.secretKey }
      } else {
        const issued = await add.mutateAsync({ device_id: trimmedId, kind: 'SENSOR', chip_mac: chip.mac })
        secret = issued
        flashed = { deviceId: trimmedId, mac: chip.mac, secretKey: issued.secret_key }
        setPending(flashed)
      }
      if (!secret.broker_secret) throw new Error(t('Máy chủ không trả mật khẩu kết nối'))
      const reply = await serial.writeIdentity({
        deviceId: trimmedId, brokerSecret: secret.broker_secret, broker: secret.broker_host, force: needsOverwrite,
      })
      if (!reply.ok) throw new Error(t(CHIP_ERROR_TEXT[reply.error ?? ''] ?? 'Bo mạch từ chối nạp ({{code}})', { code: reply.error ?? '' }))
      setPending(null)
      setLast(flashed)
      setSession(previous => [flashed, ...previous.filter(item => item.deviceId !== flashed.deviceId)])
      setStep('done')
      // Bo mạch tự khởi động lại để dùng mã mới; cổng đóng để cắm bo tiếp theo
      await closePort()
    } catch (err) {
      setStep('ready')
      // Lỗi của bo mạch hoặc của bước này thì báo nguyên câu; lỗi của máy chủ (axios) đọc từ response
      const isLocal = err instanceof SerialError || (err instanceof Error && !('response' in err))
      setError(isLocal ? t((err as Error).message) : apiErrorMessage(err, t('Nạp thất bại')))
    }
  }

  const title = t('Nạp thiết bị qua USB')
  return (
    <Modal open={open} onClose={onClose} size="lg" ariaLabel={title}>
      <div className="flex flex-col gap-5">
        <ModalHeader
          title={title}
          description="Cắm bộ điều khiển vào máy tính bằng cáp USB. Mã thiết bị và mật khẩu kết nối được ghi thẳng vào chip, rồi in nhãn dán lên bo mạch."
        />

        {!supported && (
          <p className="flex items-start gap-2 rounded-2xl bg-orange-50 p-4 text-sm text-orange-700">
            <WarningCircleIcon size={18} className="mt-0.5 shrink-0" aria-hidden />
            {t('Trình duyệt này không kết nối được USB. Dùng Chrome hoặc Edge trên máy tính.')}
          </p>
        )}

        {supported && (step === 'start' || step === 'reading') && (
          <section className="flex flex-col items-start gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-charcoal">
              {step === 'reading'
                ? t('Đang chờ bo mạch khởi động và trả lời…')
                : t('Cắm bo mạch rồi bấm Kết nối, chọn cổng của nó (thường là CP210x hoặc CH340).')}
            </p>
            <Button onClick={() => void connect()} loading={step === 'reading'}>
              <UsbIcon size={16} aria-hidden />{t('Kết nối bo mạch')}
            </Button>
            <p className="text-xs text-warmGray">{t('Không thấy cổng: cài driver CP210x hoặc CH340, và dùng cáp USB có truyền dữ liệu.')}</p>
          </section>
        )}

        {chip && (step === 'ready' || step === 'writing') && (
          <section className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
              <dt className="text-warmGray">{t('MAC của chip')}</dt>
              <dt className="text-warmGray">{t('Firmware')}</dt>
              <dt className="hidden text-warmGray sm:block">{t('Mã đang có')}</dt>
              <dd className="font-mono font-semibold text-charcoal">{chip.mac}</dd>
              <dd className="font-mono font-semibold text-charcoal">{chip.fw}</dd>
              <dd className="hidden font-mono font-semibold text-charcoal sm:block">{chip.deviceId ?? t('Chưa có')}</dd>
            </dl>
            <Input
              label="Mã thiết bị"
              required
              autoComplete="off"
              value={deviceId}
              onChange={event => setDeviceId(event.target.value)}
              error={idError}
              disabled={step === 'writing'}
            />
            {isReflash && (
              <p className="text-xs text-warmGray">
                {t('Mã này đã có trong kho: nạp lại sẽ cấp mật khẩu kết nối mới cho bo mạch. Nhãn cũ trên bo vẫn dùng được.')}
              </p>
            )}
            {needsOverwrite && (
              <label className="flex items-start gap-2 text-sm text-charcoal">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={confirmOverwrite}
                  onChange={event => setConfirmOverwrite(event.target.checked)}
                  disabled={step === 'writing'}
                />
                {t('Bo mạch đang mang mã {{id}}. Tôi muốn ghi đè.', { id: chip.deviceId ?? '' })}
              </label>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => void connect()} disabled={step === 'writing'}>{t('Kết nối bo khác')}</Button>
              <Button onClick={() => void flash()} disabled={!canFlash} loading={step === 'writing'}>
                {isReflash ? t('Nạp lại') : t('Thêm vào kho và nạp')}
              </Button>
            </div>
          </section>
        )}

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-2xl bg-orange-50 p-4 text-sm text-orange-700">
            <WarningCircleIcon size={18} className="mt-0.5 shrink-0" aria-hidden />{error}
          </p>
        )}

        {step === 'done' && last && (
          <section className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="flex items-center gap-2 text-body font-semibold text-charcoal">
              <CheckCircleIcon size={20} weight="fill" className="text-accent-600" aria-hidden />
              {t('Đã nạp {{id}}. Bo mạch đang khởi động lại với mã mới.', { id: last.deviceId })}
            </p>
            {last.secretKey ? (
              <div className="flex items-center gap-4">
                {qr
                  ? <img src={qr} alt={t('Mã QR nhãn thiết bị')} className="h-28 w-28 shrink-0 rounded-lg bg-white" />
                  : <div className="h-28 w-28 shrink-0 animate-pulse rounded-lg bg-gray-200" />}
                <div className="flex flex-col items-start gap-2">
                  <p className="text-sm text-charcoal">{t('Dán nhãn lên bo mạch đang cắm.')}</p>
                  <Button variant="secondary" onClick={() => printLabel(last)}>{t('In nhãn')}</Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-warmGray">{t('Nhãn cũ trên bo mạch vẫn dùng được.')}</p>
            )}
            <Button className="self-start" onClick={() => void connect()}>
              <UsbIcon size={16} aria-hidden />{t('Nạp bo tiếp theo')}
            </Button>
          </section>
        )}

        {session.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-small font-semibold text-warmGray">{t('Đã nạp trong phiên ({{n}})', { n: session.length })}</h3>
            <ul className="divide-y divide-gray-200 rounded-2xl border border-gray-200">
              {session.map(item => (
                <li key={item.deviceId} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                  <span className="font-mono text-charcoal">{item.deviceId}</span>
                  <span className="font-mono text-xs text-warmGray">{item.mac}</span>
                  {item.secretKey
                    ? <Button variant="secondary" size="sm" onClick={() => printLabel(item)}>{t('In lại nhãn')}</Button>
                    : <span className="text-xs text-warmGray">{t('Nạp lại')}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Modal>
  )
}

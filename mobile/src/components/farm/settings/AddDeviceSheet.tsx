import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { KeyboardIcon, QrCodeIcon } from 'phosphor-react-native'
import { ChoiceChips } from '@/components/analytics/ChoiceChips'
import { DeviceSetupProgress } from '@/components/farm/settings/DeviceSetupProgress'
import { DeviceWifiGuide } from '@/components/farm/settings/DeviceWifiGuide'
import { QrScanner } from '@/components/farm/settings/QrScanner'
import { SettingsActionBar } from '@/components/farm/settings/SettingsActionBar'
import { SettingsMetaGrid } from '@/components/farm/settings/SettingsMetaGrid'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { useRegisterCameraNode } from '@/hooks/device/useRegisterCameraNode'
import { useRegisterSensorNode } from '@/hooks/device/useRegisterSensorNode'
import { useZoneDirectory } from '@/hooks/farm/useZoneDirectory'
import { usePalette } from '@/hooks/theme/usePalette'
import { getDeviceRegisterErrorMessage } from '@/utils/apiError.utils'
import { parseDeviceLabel, parseZoneCode } from '@/utils/qrCode.utils'
import { t } from '@/utils/i18n.utils'

// Thiết bị gắn vào đâu: camera AI gắn nhà (FARM-FR-004), controller gắn một tầng (FARM-FR-003). zones: các khu vực của nhà
// đang mở, để chọn từ danh sách khi không quét mã tầng (FARM-FR-007)
export type AddDeviceTarget =
  | { kind: 'camera'; houseId: string; name: string }
  | { kind: 'controller'; zoneId: string; name: string; zones: { _id: string; name: string }[] }

interface AddDeviceSheetProps {
  // null: sheet đóng. Mỗi lần mở, màn truyền key mới để sheet bắt đầu trống
  target: AddDeviceTarget | null
  onClose: () => void
  onRegistered: (message: string) => void
}

// scan: quét nhãn (và mã tầng); form: xem lại, chọn khu vực, gửi; zone-scan: quét mã tầng; setup: hướng dẫn Wi-Fi + tiến trình
type SheetMode = 'scan' | 'form' | 'zone-scan' | 'setup'

// Thiết bị vừa đăng ký: mã in trên nhãn và _id bản ghi để theo dõi tiến trình
interface RegisteredDevice {
  deviceId: string
  recordId: string
}

// Setup thiết bị bằng hai lần quét (SF-01): nhãn thiết bị `swiftletcare://claim?…` và mã tầng `swiftletcare://zone?…`, theo
// thứ tự nào cũng được (hoặc gõ tay mã trên nhãn, chọn khu vực từ danh sách) → đăng ký → hướng dẫn cài Wi-Fi (FARM-FR-003b)
// → tiến trình (FARM-FR-012). Mã kích hoạt chỉ nằm trong ô nhập và đi một lần tới API — không lưu, không ghi log (FARM-FR-010)
export function AddDeviceSheet({ target, onClose, onRegistered }: AddDeviceSheetProps) {
  const palette = usePalette()
  const directory = useZoneDirectory()
  const registerSensorNode = useRegisterSensorNode()
  const registerCameraNode = useRegisterCameraNode()
  const [mode, setMode] = useState<SheetMode>('scan')
  const [scanAttempt, setScanAttempt] = useState(0)
  const [scanNotice, setScanNotice] = useState<string | null>(null)
  const [deviceId, setDeviceId] = useState('')
  const [activationKey, setActivationKey] = useState('')
  const [zoneId, setZoneId] = useState(target?.kind === 'controller' ? target.zoneId : '')
  const [registered, setRegistered] = useState<RegisteredDevice | null>(null)
  const mutation = target?.kind === 'camera' ? registerCameraNode : registerSensorNode
  const isCamera = target?.kind === 'camera'
  const houseZones = target?.kind === 'controller' ? target.zones : []

  // Tên khu vực đang chọn: khu vực của nhà đang mở ghi tên; khu vực nhà khác (quét mã tầng nhà khác) ghi kèm tên nhà
  const getZoneName = (id: string): string => {
    const zoneInHouse = houseZones.find(zone => zone._id === id)
    if (zoneInHouse) return zoneInHouse.name
    const zone = directory.zoneById.get(id)
    if (!zone) return '_'
    const house = directory.houseById.get(zone.house_id)
    return house ? `${house.name} › ${zone.name}` : zone.name
  }

  // Mã tầng đọc được: chỉ nhận khu vực người dùng được xem (backend vẫn kiểm quyền, 403 nếu không có, FARM-FR-007)
  const applyZoneCode = (scannedZoneId: string): boolean => {
    if (!directory.zoneById.has(scannedZoneId)) {
      setScanNotice(t('Mã tầng này không thuộc trang trại của bạn'))
      return false
    }
    setZoneId(scannedZoneId)
    return true
  }

  const restartScan = () => setScanAttempt(attempt => attempt + 1)

  // Quét ở bước đầu: nhãn thiết bị thì sang xem lại; mã tầng (controller) thì nhớ khu vực rồi quét tiếp nhãn
  const handleScanned = (data: string) => {
    const label = parseDeviceLabel(data)
    if (label) {
      setDeviceId(label.deviceId)
      setActivationKey(label.activationKey)
      setScanNotice(null)
      setMode('form')
      return
    }
    const scannedZoneId = parseZoneCode(data)
    if (scannedZoneId && !isCamera) {
      if (applyZoneCode(scannedZoneId)) {
        setScanNotice(t('Đã chọn {zone}. Giờ quét nhãn dán trên thiết bị', { zone: getZoneName(scannedZoneId) }))
      }
      restartScan()
      return
    }
    setScanNotice(
      scannedZoneId
        ? t('Camera gắn theo nhà, không cần mã tầng. Hãy quét nhãn dán trên camera')
        : t('Mã này không phải nhãn thiết bị SwiftletCare'),
    )
    restartScan()
  }

  // Quét mã tầng từ bước xem lại: đọc được thì quay lại bước xem lại
  const handleZoneScanned = (data: string) => {
    const scannedZoneId = parseZoneCode(data)
    if (!scannedZoneId) {
      setScanNotice(t('Mã này không phải mã tầng SwiftletCare'))
      restartScan()
      return
    }
    if (applyZoneCode(scannedZoneId)) {
      setScanNotice(null)
      setMode('form')
      return
    }
    restartScan()
  }

  const submit = () => {
    if (!target) return
    const payload = { device_id: deviceId.trim(), secret_key: activationKey.trim() }
    const onSuccess = (device: { _id: string }) => {
      setRegistered({ deviceId: payload.device_id, recordId: device._id })
      // Bỏ mã kích hoạt khỏi ô nhập ngay khi đã gửi xong
      setActivationKey('')
      setMode('setup')
    }
    if (target.kind === 'camera') {
      registerCameraNode.mutate({ ...payload, house_id: target.houseId }, { onSuccess })
    } else {
      registerSensorNode.mutate({ ...payload, zone_id: zoneId }, { onSuccess })
    }
  }

  const finish = () => {
    if (!registered) return
    onRegistered(t('Đã thêm {device}', { device: registered.deviceId }))
  }

  const isFilled = deviceId.trim() !== '' && activationKey.trim() !== '' && (isCamera || zoneId !== '')

  const renderScan = () => (
    <View style={styles.body}>
      <QrScanner key={scanAttempt} onScanned={handleScanned} />
      <FormMessage message={scanNotice} tone={scanNotice && zoneId && !isCamera ? 'success' : 'error'} />
      <Text variant="small" color={palette.textSecondary}>
        {isCamera
          ? t('Đưa nhãn QR trên camera vào giữa khung')
          : t('Quét nhãn trên thiết bị và mã QR dán ở tầng, thứ tự nào cũng được')}
      </Text>
      <Button label={t('Nhập tay mã trên nhãn')} variant="link" onPress={() => setMode('form')} style={styles.center} />
      <View style={styles.switchRow}>
        <KeyboardIcon size={16} color={palette.textSecondary} />
        <Text variant="small" color={palette.textSecondary}>
          {t('Không quét được thì nhập hai mã in dưới mã QR')}
        </Text>
      </View>
    </View>
  )

  const renderZoneScan = () => (
    <View style={styles.body}>
      <QrScanner key={`zone-${scanAttempt}`} onScanned={handleZoneScanned} />
      <FormMessage message={scanNotice} />
      <Text variant="small" color={palette.textSecondary}>
        {t('Đưa mã QR dán ở tầng vào giữa khung')}
      </Text>
      <Button
        label={t('Chọn khu vực từ danh sách')}
        variant="link"
        onPress={() => {
          setScanNotice(null)
          setMode('form')
        }}
        style={styles.center}
      />
    </View>
  )

  const renderForm = () => (
    <View style={styles.body}>
      <SettingsMetaGrid
        items={[
          ...(isCamera ? [{ label: t('Gắn vào nhà'), value: target?.name, isFullWidth: true }] : []),
          {
            label: t('Mã thiết bị'),
            input: { value: deviceId, onChangeText: setDeviceId, label: t('Mã thiết bị'), keyboardType: 'default' as const },
            isFullWidth: true,
          },
          {
            label: t('Mã kích hoạt'),
            input: {
              value: activationKey,
              onChangeText: setActivationKey,
              label: t('Mã kích hoạt'),
              keyboardType: 'default' as const,
              autoCapitalize: 'characters' as const,
            },
            isFullWidth: true,
          },
        ]}
      />
      {!isCamera && (
        <View style={styles.zonePicker}>
          <Text variant="small" color={palette.textSecondary}>
            {t('Gắn vào khu vực: {zone}', { zone: zoneId ? getZoneName(zoneId) : '_' })}
          </Text>
          {houseZones.length > 1 && (
            <ChoiceChips
              options={houseZones.map(zone => ({ id: zone._id, label: zone.name }))}
              selectedId={zoneId}
              onSelect={setZoneId}
              placement="card"
              accessibilityLabel={t('Chọn khu vực')}
            />
          )}
          <View style={styles.switchRow}>
            <QrCodeIcon size={16} color={palette.textSecondary} />
            <Button
              label={t('Quét mã tầng')}
              variant="link"
              onPress={() => {
                setScanNotice(null)
                setMode('zone-scan')
              }}
            />
          </View>
        </View>
      )}
      <FormMessage message={mutation.error ? getDeviceRegisterErrorMessage(mutation.error) : null} />
      <SettingsActionBar
        label={t('Đăng ký thiết bị')}
        value={t('GỬI')}
        onPress={submit}
        disabled={!isFilled}
        loading={mutation.isPending}
        accessibilityLabel={t('Đăng ký thiết bị')}
      />
      <View style={styles.switchRow}>
        <QrCodeIcon size={16} color={palette.textSecondary} />
        <Button
          label={t('Quét lại nhãn QR')}
          variant="link"
          onPress={() => {
            setScanNotice(null)
            setMode('scan')
          }}
        />
      </View>
    </View>
  )

  const renderSetup = () =>
    registered ? (
      <ScrollView style={styles.setupScroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <FormMessage
          tone="success"
          message={
            isCamera
              ? t('Đã đăng ký {device} vào {place}', { device: registered.deviceId, place: target?.name ?? '_' })
              : t('Đã đăng ký {device} vào {place}', { device: registered.deviceId, place: getZoneName(zoneId) })
          }
        />
        {/* Camera là máy đếm chim tự nối mạng, không có bước cài Wi-Fi trên điện thoại */}
        {!isCamera && <DeviceWifiGuide deviceId={registered.deviceId} />}
        <DeviceSetupProgress kind={isCamera ? 'camera' : 'controller'} deviceRecordId={registered.recordId} />
        <Button label={t('Xong')} onPress={finish} />
      </ScrollView>
    ) : null

  const renderBody = () => {
    if (mode === 'setup') return renderSetup()
    if (mode === 'zone-scan') return renderZoneScan()
    if (mode === 'form') return renderForm()
    return renderScan()
  }

  return (
    // Đang ở bước theo dõi: đóng sheet cũng tính là xong (thiết bị đã đăng ký)
    <BottomSheet visible={target !== null} onClose={registered ? finish : onClose}>
      <View style={styles.header}>
        <Text variant="heading" style={styles.flex}>
          {isCamera ? t('Thêm camera AI') : t('Thêm bộ điều khiển')}
        </Text>
        <Text variant="small" weight="semiBold" color={palette.textSecondary} style={styles.overline} numberOfLines={1}>
          {isCamera ? (target?.name ?? '') : zoneId ? getZoneName(zoneId) : ''}
        </Text>
      </View>
      {renderBody()}
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1 },
  overline: { textTransform: 'uppercase', letterSpacing: 1, maxWidth: '45%' },
  body: { gap: Spacing.md },
  center: { alignSelf: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs },
  zonePicker: { gap: Spacing.sm },
  setupScroll: { maxHeight: 520 },
})

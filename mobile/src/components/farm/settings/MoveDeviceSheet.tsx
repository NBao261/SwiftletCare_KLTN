import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { QrCodeIcon } from 'phosphor-react-native'
import { ChoiceChips } from '@/components/analytics/ChoiceChips'
import { DeviceSetupProgress } from '@/components/farm/settings/DeviceSetupProgress'
import { QrScanner } from '@/components/farm/settings/QrScanner'
import { SettingsActionBar } from '@/components/farm/settings/SettingsActionBar'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import { useReassignZone } from '@/hooks/device/useReassignZone'
import { useZoneDirectory } from '@/hooks/farm/useZoneDirectory'
import { usePalette } from '@/hooks/theme/usePalette'
import type { DeviceStatus } from '@/types'
import { getDeviceMoveErrorMessage } from '@/utils/apiError.utils'
import { canReassignZone } from '@/utils/device.utils'
import { parseZoneCode } from '@/utils/qrCode.utils'
import { t } from '@/utils/i18n.utils'

// Controller cần dời: _id bản ghi, mã in trên nhãn, trạng thái kết nối và khu vực đang ở
export interface MoveDeviceTarget {
  recordId: string
  deviceId: string
  status: DeviceStatus
  zoneId: string
  // Các khu vực của nhà đang mở, để chọn từ danh sách khi không quét mã tầng
  zones: { _id: string; name: string }[]
}

interface MoveDeviceSheetProps {
  // null: sheet đóng. Mỗi lần mở, màn truyền key mới để sheet bắt đầu trống
  target: MoveDeviceTarget | null
  onClose: () => void
  onMoved: (message: string) => void
}

// pick: chọn khu vực đích; scan: quét mã tầng mới; progress: đã dời, theo dõi bước áp cấu hình của khu vực mới
type SheetMode = 'pick' | 'scan' | 'progress'

// Dời controller đã lắp sang khu vực khác (FARM-FR-007b): quét mã QR dán ở tầng mới (FARM-FR-011) hoặc chọn khu vực, rồi theo
// dõi tới khi controller áp cấu hình của khu vực mới (FARM-FR-012). Backend chỉ dời thiết bị đang trực tuyến (409 nếu không)
export function MoveDeviceSheet({ target, onClose, onMoved }: MoveDeviceSheetProps) {
  const palette = usePalette()
  const directory = useZoneDirectory()
  const reassignZone = useReassignZone()
  const [mode, setMode] = useState<SheetMode>('pick')
  const [scanAttempt, setScanAttempt] = useState(0)
  const [scanNotice, setScanNotice] = useState<string | null>(null)
  const [newZoneId, setNewZoneId] = useState('')
  const houseZones = target?.zones ?? []
  const otherZones = houseZones.filter(zone => zone._id !== target?.zoneId)
  const isOnline = target ? canReassignZone(target.status) : false

  // Tên khu vực: khu vực của nhà đang mở ghi tên; khu vực nhà khác (quét mã tầng nhà khác) ghi kèm tên nhà
  const getZoneName = (id: string): string => {
    const zoneInHouse = houseZones.find(zone => zone._id === id)
    if (zoneInHouse) return zoneInHouse.name
    const zone = directory.zoneById.get(id)
    if (!zone) return '_'
    const house = directory.houseById.get(zone.house_id)
    return house ? `${house.name} › ${zone.name}` : zone.name
  }

  // Mã tầng đọc được: phải là khu vực người dùng được xem và khác khu vực đang ở (backend vẫn kiểm, 403 / 400)
  const handleZoneScanned = (data: string) => {
    const scannedZoneId = parseZoneCode(data)
    if (!scannedZoneId) {
      setScanNotice(t('Mã này không phải mã tầng SwiftletCare'))
    } else if (scannedZoneId === target?.zoneId) {
      setScanNotice(t('Thiết bị đang ở khu vực này rồi'))
    } else if (!directory.zoneById.has(scannedZoneId)) {
      setScanNotice(t('Mã tầng này không thuộc trang trại của bạn'))
    } else {
      setNewZoneId(scannedZoneId)
      setScanNotice(null)
      setMode('pick')
      return
    }
    setScanAttempt(attempt => attempt + 1)
  }

  const submit = () => {
    if (!target || !newZoneId) return
    reassignZone.mutate({ sensorNodeId: target.recordId, newZoneId }, { onSuccess: () => setMode('progress') })
  }

  const finish = () => {
    if (!target) return
    onMoved(t('Đã dời {device} sang {zone}', { device: target.deviceId, zone: getZoneName(newZoneId) }))
  }

  const renderPick = () => (
    <View style={styles.body}>
      {!isOnline && (
        <FormMessage
          message={t('Chỉ dời được khi thiết bị đang trực tuyến. Bật nguồn và chờ thiết bị kết nối rồi thử lại.')}
        />
      )}
      <Text variant="small" color={palette.textSecondary}>
        {t('Đang ở: {zone}', { zone: target ? getZoneName(target.zoneId) : '_' })}
      </Text>
      <Text variant="small" color={palette.textSecondary}>
        {t('Dời sang: {zone}', { zone: newZoneId ? getZoneName(newZoneId) : '_' })}
      </Text>
      {otherZones.length > 0 && (
        <ChoiceChips
          options={otherZones.map(zone => ({ id: zone._id, label: zone.name }))}
          selectedId={newZoneId || null}
          onSelect={setNewZoneId}
          placement="card"
          disabled={!isOnline}
          accessibilityLabel={t('Chọn khu vực mới')}
        />
      )}
      <View style={styles.switchRow}>
        <QrCodeIcon size={16} color={palette.textSecondary} />
        <Button
          label={t('Quét mã tầng mới')}
          variant="link"
          disabled={!isOnline}
          onPress={() => {
            setScanNotice(null)
            setMode('scan')
          }}
        />
      </View>
      <FormMessage message={reassignZone.error ? getDeviceMoveErrorMessage(reassignZone.error) : null} />
      <SettingsActionBar
        label={t('Dời thiết bị')}
        value={t('GỬI')}
        onPress={submit}
        disabled={!isOnline || !newZoneId}
        loading={reassignZone.isPending}
        accessibilityLabel={t('Dời thiết bị')}
      />
    </View>
  )

  const renderScan = () => (
    <View style={styles.body}>
      <QrScanner key={`zone-${scanAttempt}`} onScanned={handleZoneScanned} />
      <FormMessage message={scanNotice} />
      <Text variant="small" color={palette.textSecondary}>
        {t('Đưa mã QR dán ở tầng mới vào giữa khung')}
      </Text>
      <Button
        label={t('Chọn khu vực từ danh sách')}
        variant="link"
        onPress={() => {
          setScanNotice(null)
          setMode('pick')
        }}
        style={styles.center}
      />
    </View>
  )

  const renderProgress = () =>
    target ? (
      <ScrollView style={styles.progressScroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <FormMessage
          tone="success"
          message={t('Đã dời {device} sang {zone}', { device: target.deviceId, zone: getZoneName(newZoneId) })}
        />
        <DeviceSetupProgress kind="controller" deviceRecordId={target.recordId} />
        <Button label={t('Xong')} onPress={finish} />
      </ScrollView>
    ) : null

  const renderBody = () => {
    if (mode === 'progress') return renderProgress()
    if (mode === 'scan') return renderScan()
    return renderPick()
  }

  return (
    // Đã dời xong: đóng sheet cũng tính là xong
    <BottomSheet visible={target !== null} onClose={mode === 'progress' ? finish : onClose}>
      <View style={styles.header}>
        <Text variant="heading" style={styles.flex}>
          {t('Dời sang khu vực khác')}
        </Text>
        <Text variant="small" weight="semiBold" color={palette.textSecondary} style={styles.overline} numberOfLines={1}>
          {target?.deviceId ?? ''}
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
  progressScroll: { maxHeight: 520 },
})

import { CpuIcon, QrCodeIcon, VideoCameraIcon } from 'phosphor-react-native'
import { SettingsActionBar } from '@/components/farm/settings/SettingsActionBar'
import { SettingsSection } from '@/components/farm/settings/SettingsSection'
import { SettingsTable, type SettingsTableRow } from '@/components/farm/settings/SettingsTable'
import { Button } from '@/components/ui/button'
import type { SectionEditor } from '@/hooks/farm/useSingleSectionEdit'
import type { DeviceStatus } from '@/types'
import { getDeviceStatusLabel } from '@/utils/label.utils'
import { t } from '@/utils/i18n.utils'

interface ListedDevice {
  _id: string
  device_id: string
  status: DeviceStatus
}

interface DeviceListSectionProps {
  id: string
  kind: 'camera' | 'controller'
  devices: ListedDevice[]
  scopeLabel: string
  editor: SectionEditor
  // Có quyền thêm thì truyền: nút "Thêm…" và ô QR ở chân card mở sheet đăng ký
  onAdd?: () => void
}

// Mục danh sách thiết bị: camera AI của nhà (FARM-FR-004) hoặc controller của một tầng (FARM-FR-003).
// Không có nút "Sửa": thiết bị thêm bằng nhãn QR / nhập tay, gỡ và chuyển thiết bị là việc của Technician (FARM-FR-008)
export function DeviceListSection({ id, kind, devices, scopeLabel, editor, onAdd }: DeviceListSectionProps) {
  const isCamera = kind === 'camera'
  const onlineCount = devices.filter(device => device.status === 'ONLINE').length

  const rows: SettingsTableRow[] = devices.map(device => ({
    id: device._id,
    cells: [
      { text: device.device_id },
      { text: getDeviceStatusLabel(device.status), isMuted: device.status !== 'ONLINE' },
    ],
    accessibilityLabel: `${device.device_id}: ${getDeviceStatusLabel(device.status)}`,
  }))

  return (
    <SettingsSection
      icon={isCamera ? VideoCameraIcon : CpuIcon}
      title={isCamera ? t('Camera AI') : t('Controller')}
      subtitle={isCamera ? t('Đếm chim ở cửa ra vào của cả nhà') : t('Đo môi trường và bật tắt relay của tầng')}
      scopeLabel={scopeLabel}
      isExpanded={editor.isExpanded(id)}
      onToggle={() => editor.toggle(id)}
      footerNote={onAdd ? t('Quét nhãn QR trên thiết bị hoặc nhập tay mã in trên nhãn') : t('Chủ trại thêm thiết bị')}
      footerTile={onAdd ? { icon: QrCodeIcon, label: t('Quét nhãn QR để thêm thiết bị'), onPress: onAdd } : undefined}
    >
      <SettingsTable
        columns={[
          { label: t('Thiết bị'), flex: 2 },
          { label: t('Trạng thái'), align: 'right', flex: 1.5 },
        ]}
        rows={rows}
        emptyText={isCamera ? t('Nhà chưa có camera') : t('Tầng chưa có controller')}
      />
      {devices.length > 0 && (
        <SettingsActionBar label={t('Đang trực tuyến')} value={`${onlineCount}/${devices.length}`} />
      )}
      {onAdd && <Button label={isCamera ? t('Thêm camera') : t('Thêm controller')} size="md" onPress={onAdd} />}
    </SettingsSection>
  )
}

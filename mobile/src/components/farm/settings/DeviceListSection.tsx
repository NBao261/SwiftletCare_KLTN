import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import {
  ArrowCounterClockwiseIcon,
  ArrowsLeftRightIcon,
  CpuIcon,
  QrCodeIcon,
  SwapIcon,
  TrashIcon,
  VideoCameraIcon,
} from 'phosphor-react-native'
import { ActionMenuSheet, type MenuAction } from '@/components/farm/ActionMenuSheet'
import { MoveDeviceSheet, type MoveDeviceTarget } from '@/components/farm/settings/MoveDeviceSheet'
import {
  RemoveDeviceSheet,
  type RemovedDevice,
  type RemoveDeviceTarget,
} from '@/components/farm/settings/RemoveDeviceSheet'
import { SettingsActionBar } from '@/components/farm/settings/SettingsActionBar'
import { SettingsSection } from '@/components/farm/settings/SettingsSection'
import { SettingsTable, type SettingsTableRow } from '@/components/farm/settings/SettingsTable'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { Spacing } from '@/constants/theme'
import type { SectionEditor } from '@/hooks/farm/useSingleSectionEdit'
import { usePalette } from '@/hooks/theme/usePalette'
import type { DeviceStatus } from '@/types'
import { canReassignZone, type DeviceAction, getDeviceActions, isWithinRestoreWindow } from '@/utils/device.utils'
import { getDeviceStatusLabel } from '@/utils/label.utils'
import { t } from '@/utils/i18n.utils'

export interface ListedDevice {
  _id: string
  device_id: string
  status: DeviceStatus
}

// Quản lý thiết bị đã lắp (Farm Owner, SF-01): khu vực của mục (controller), các khu vực của nhà để dời, thay thiết bị (mở sheet
// thêm thiết bị ở chế độ thay), báo kết quả
export interface DeviceManageOptions {
  zone?: { _id: string; zones: { _id: string; name: string }[] }
  onReplace?: (device: ListedDevice) => void
  onDone: (message: string) => void
}

interface DeviceListSectionProps {
  id: string
  kind: 'camera' | 'controller'
  devices: ListedDevice[]
  scopeLabel: string
  editor: SectionEditor
  // Có quyền thêm thì truyền: nút "Thêm…" và ô QR ở chân card mở sheet đăng ký
  onAdd?: () => void
  // Có quyền quản lý thì truyền: bấm một dòng mở thao tác dời, thay, gỡ (FARM-FR-007b, 008)
  manage?: DeviceManageOptions
}

// Tên và dòng phụ của từng thao tác trong bảng ⋮ của một thiết bị
function getActionText(action: DeviceAction, device: ListedDevice): { label: string; caption: string } {
  if (action === 'move') {
    return {
      label: t('Dời sang khu vực khác'),
      caption: canReassignZone(device.status)
        ? t('Quét mã tầng mới hoặc chọn khu vực')
        : t('Chỉ dời được khi thiết bị đang trực tuyến'),
    }
  }
  if (action === 'replace') return { label: t('Thay thiết bị'), caption: t('Quét nhãn thiết bị mới, giữ khu vực và lịch sử') }
  return { label: t('Gỡ thiết bị'), caption: t('Ẩn khỏi danh sách, giữ lịch sử, khôi phục được trong 24 giờ') }
}

const ACTION_ICONS = { move: ArrowsLeftRightIcon, replace: SwapIcon, remove: TrashIcon } as const

// Mục danh sách thiết bị: camera AI của nhà (FARM-FR-004) hoặc controller của một tầng (FARM-FR-003). Không có nút "Sửa": thiết bị
// thêm bằng nhãn QR / nhập tay; Farm Owner bấm một thiết bị để dời, thay, gỡ (FARM-FR-007b, 008). Danh sách của backend không trả
// thiết bị đã gỡ, nên nút khôi phục chỉ có ngay sau khi gỡ, lúc mục này còn mở
export function DeviceListSection({ id, kind, devices, scopeLabel, editor, onAdd, manage }: DeviceListSectionProps) {
  const palette = usePalette()
  const isCamera = kind === 'camera'
  const onlineCount = devices.filter(device => device.status === 'ONLINE').length
  const [menuDevice, setMenuDevice] = useState<ListedDevice | null>(null)
  const [moveTarget, setMoveTarget] = useState<MoveDeviceTarget | null>(null)
  const [removeTarget, setRemoveTarget] = useState<RemoveDeviceTarget | null>(null)
  const [recentlyRemoved, setRecentlyRemoved] = useState<RemovedDevice | null>(null)
  // Mỗi lần mở sheet một key mới để sheet bắt đầu trống
  const [sheetKey, setSheetKey] = useState(0)
  const canRestore = recentlyRemoved !== null && isWithinRestoreWindow(recentlyRemoved.decommissionedAt)

  const runAction = (action: DeviceAction, device: ListedDevice) => {
    setSheetKey(key => key + 1)
    if (action === 'move' && manage?.zone) {
      setMoveTarget({
        recordId: device._id,
        deviceId: device.device_id,
        status: device.status,
        zoneId: manage.zone._id,
        zones: manage.zone.zones,
      })
    } else if (action === 'replace') {
      manage?.onReplace?.(device)
    } else if (action === 'remove') {
      setRemoveTarget({ mode: 'remove', kind, recordId: device._id, deviceId: device.device_id, status: device.status })
    }
  }

  const menuActions: MenuAction[] = menuDevice
    ? getDeviceActions(kind)
        .filter(action => (action === 'move' ? Boolean(manage?.zone) : action === 'replace' ? Boolean(manage?.onReplace) : true))
        .map(action => ({
          icon: ACTION_ICONS[action],
          ...getActionText(action, menuDevice),
          onPress: () => runAction(action, menuDevice),
        }))
    : []

  const openRestore = () => {
    if (!recentlyRemoved) return
    setSheetKey(key => key + 1)
    setRemoveTarget({
      mode: 'restore',
      kind: recentlyRemoved.kind,
      recordId: recentlyRemoved.recordId,
      deviceId: recentlyRemoved.deviceId,
    })
  }

  const rows: SettingsTableRow[] = devices.map(device => ({
    id: device._id,
    cells: [
      { text: device.device_id },
      { text: getDeviceStatusLabel(device.status), isMuted: device.status !== 'ONLINE' },
    ],
    onPress: manage ? () => setMenuDevice(device) : undefined,
    accessibilityLabel: `${device.device_id}: ${getDeviceStatusLabel(device.status)}`,
  }))

  return (
    <>
      <SettingsSection
        icon={isCamera ? VideoCameraIcon : CpuIcon}
        title={isCamera ? t('Camera AI') : t('Bộ điều khiển')}
        subtitle={isCamera ? t('Đếm chim ở cửa ra vào của cả nhà') : t('Đo môi trường, bật tắt phun sương, quạt, loa')}
        scopeLabel={scopeLabel}
        isExpanded={editor.isExpanded(id)}
        onToggle={() => editor.toggle(id)}
        footerNote={onAdd ? t('Quét nhãn QR trên thiết bị hoặc nhập tay mã in trên nhãn') : undefined}
        footerTile={onAdd ? { icon: QrCodeIcon, label: t('Quét nhãn QR để thêm thiết bị'), onPress: onAdd } : undefined}
      >
        <SettingsTable
          columns={[
            { label: t('Thiết bị'), flex: 2 },
            { label: t('Trạng thái'), align: 'right', flex: 1.5 },
          ]}
          rows={rows}
          emptyText={isCamera ? t('Nhà chưa có camera') : t('Khu vực chưa có bộ điều khiển')}
        />
        {canRestore && recentlyRemoved && (
          <View style={styles.removedRow}>
            <ArrowCounterClockwiseIcon size={16} color={palette.textSecondary} />
            <Text variant="small" color={palette.textSecondary} style={styles.flex}>
              {t('Vừa gỡ {device}. Khôi phục được trong 24 giờ', { device: recentlyRemoved.deviceId })}
            </Text>
            <Button
              label={t('Khôi phục')}
              variant="link"
              onPress={openRestore}
              accessibilityLabel={t('Khôi phục {device}', { device: recentlyRemoved.deviceId })}
            />
          </View>
        )}
        {devices.length > 0 && (
          <SettingsActionBar label={t('Đang trực tuyến')} value={`${onlineCount}/${devices.length}`} />
        )}
        {onAdd && <Button label={isCamera ? t('Thêm camera') : t('Thêm bộ điều khiển')} size="md" onPress={onAdd} />}
      </SettingsSection>

      {manage && (
        <>
          <ActionMenuSheet
            visible={menuDevice !== null}
            title={menuDevice?.device_id ?? ''}
            actions={menuActions}
            onClose={() => setMenuDevice(null)}
          />
          <MoveDeviceSheet
            key={`move-${sheetKey}`}
            target={moveTarget}
            onClose={() => setMoveTarget(null)}
            onMoved={message => {
              setMoveTarget(null)
              manage.onDone(message)
            }}
          />
          <RemoveDeviceSheet
            key={`remove-${sheetKey}`}
            target={removeTarget}
            onClose={() => setRemoveTarget(null)}
            onDone={(message, removed) => {
              setRemoveTarget(null)
              setRecentlyRemoved(removed)
              manage.onDone(message)
            }}
          />
        </>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  removedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  flex: { flex: 1 },
})

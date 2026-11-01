import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { KeyboardIcon, QrCodeIcon } from 'phosphor-react-native'
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
import { usePalette } from '@/hooks/theme/usePalette'
import { getDeviceRegisterErrorMessage } from '@/utils/apiError.utils'
import { parseDeviceLabel, parseZoneCode } from '@/utils/qrCode.utils'
import { t } from '@/utils/i18n.utils'

// Thiết bị gắn vào đâu: camera AI gắn nhà (FARM-FR-004), controller gắn một tầng (FARM-FR-003)
export type AddDeviceTarget =
  | { kind: 'camera'; houseId: string; name: string }
  | { kind: 'controller'; zoneId: string; name: string }

interface AddDeviceSheetProps {
  // null: sheet đóng. Mỗi lần mở, màn truyền key mới để sheet bắt đầu trống
  target: AddDeviceTarget | null
  onClose: () => void
  onRegistered: (message: string) => void
}

// Đăng ký thiết bị bằng nhãn (MF-10): quét QR trên nhãn hoặc gõ tay mã thiết bị và mã kích hoạt, xem lại rồi gửi.
// Mã kích hoạt chỉ nằm trong ô nhập và đi một lần tới API — không lưu, không ghi log (FARM-FR-010)
export function AddDeviceSheet({ target, onClose, onRegistered }: AddDeviceSheetProps) {
  const palette = usePalette()
  const registerSensorNode = useRegisterSensorNode()
  const registerCameraNode = useRegisterCameraNode()
  const [mode, setMode] = useState<'scan' | 'form'>('scan')
  const [scanAttempt, setScanAttempt] = useState(0)
  const [scanNotice, setScanNotice] = useState<string | null>(null)
  const [deviceId, setDeviceId] = useState('')
  const [activationKey, setActivationKey] = useState('')
  const mutation = target?.kind === 'camera' ? registerCameraNode : registerSensorNode
  const isCamera = target?.kind === 'camera'

  const handleScanned = (data: string) => {
    const label = parseDeviceLabel(data)
    if (label) {
      setDeviceId(label.deviceId)
      setActivationKey(label.activationKey)
      setScanNotice(null)
      setMode('form')
      return
    }
    // Quét nhầm mã tầng hoặc mã lạ: báo rồi cho quét lại
    setScanNotice(
      parseZoneCode(data)
        ? t('Đây là mã tầng. Hãy quét nhãn dán trên thiết bị')
        : t('Mã này không phải nhãn thiết bị SwiftletCare'),
    )
    setScanAttempt(attempt => attempt + 1)
  }

  const submit = () => {
    if (!target) return
    const payload = { device_id: deviceId.trim(), secret_key: activationKey.trim() }
    const onSuccess = () =>
      onRegistered(t('Đã thêm {device}. Thiết bị chờ kết nối lần đầu', { device: payload.device_id }))
    if (target.kind === 'camera') {
      registerCameraNode.mutate({ ...payload, house_id: target.houseId }, { onSuccess })
    } else {
      registerSensorNode.mutate({ ...payload, zone_id: target.zoneId }, { onSuccess })
    }
  }

  const isFilled = deviceId.trim() !== '' && activationKey.trim() !== ''

  return (
    <BottomSheet visible={target !== null} onClose={onClose}>
      <View style={styles.header}>
        <Text variant="heading" style={styles.flex}>
          {isCamera ? t('Thêm camera AI') : t('Thêm controller')}
        </Text>
        <Text variant="small" weight="semiBold" color={palette.textSecondary} style={styles.overline} numberOfLines={1}>
          {target?.name ?? ''}
        </Text>
      </View>

      {mode === 'scan' ? (
        <View style={styles.body}>
          <QrScanner key={scanAttempt} onScanned={handleScanned} />
          <FormMessage message={scanNotice} />
          <Text variant="small" color={palette.textSecondary}>
            {t('Đưa nhãn QR trên thiết bị vào giữa khung')}
          </Text>
          <Button
            label={t('Nhập tay mã trên nhãn')}
            variant="link"
            onPress={() => setMode('form')}
            style={styles.center}
          />
        </View>
      ) : (
        <View style={styles.body}>
          <SettingsMetaGrid
            items={[
              { label: isCamera ? t('Gắn vào nhà') : t('Gắn vào tầng'), value: target?.name, isFullWidth: true },
              {
                label: t('Mã thiết bị'),
                input: {
                  value: deviceId,
                  onChangeText: setDeviceId,
                  label: t('Mã thiết bị'),
                  keyboardType: 'default',
                },
                isFullWidth: true,
              },
              {
                label: t('Mã kích hoạt'),
                input: {
                  value: activationKey,
                  onChangeText: setActivationKey,
                  label: t('Mã kích hoạt'),
                  keyboardType: 'default',
                  autoCapitalize: 'characters',
                },
                isFullWidth: true,
              },
            ]}
          />
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
      )}
      {mode === 'scan' && (
        <View style={styles.switchRow}>
          <KeyboardIcon size={16} color={palette.textSecondary} />
          <Text variant="small" color={palette.textSecondary}>
            {t('Không quét được thì nhập hai mã in dưới mã QR')}
          </Text>
        </View>
      )}
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
})

import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { LockSimpleIcon } from 'phosphor-react-native'
import { ChoiceChips } from '@/components/analytics/ChoiceChips'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { FormMessage } from '@/components/ui/form-message'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import { TextField } from '@/components/ui/text-field'
import { Radius, Spacing } from '@/constants/theme'
import { useCameraSource } from '@/hooks/device/useCameraSource'
import { useUpdateCameraSource } from '@/hooks/device/useUpdateCameraSource'
import { usePalette } from '@/hooks/theme/usePalette'
import type { CameraSourceView } from '@/types'
import { getSettingsErrorMessage } from '@/utils/apiError.utils'
import {
  buildCameraSourcePayload,
  CAMERA_PATH_PRESETS,
  type CameraSourceField,
  type CameraSourceForm,
  isCameraStatusProblem,
  parseRtspInput,
  toCameraSourceForm,
  validateCameraSource,
} from '@/utils/cameraSource.utils'
import { formatTimeAgo } from '@/utils/date.utils'
import { getCameraStatusLabel } from '@/utils/label.utils'
import { t } from '@/utils/i18n.utils'

const SKELETON_HEIGHT = 160
// Ô cổng đủ 5 chữ số
const PORT_FIELD_WIDTH = 96

export interface CameraSourceTarget {
  cameraId: string
  deviceId: string
}

interface CameraSourceSheetProps {
  target: CameraSourceTarget | null
  onClose: () => void
  onSaved: (message: string) => void
}

// Form khi đã tải xong địa chỉ đang lưu: điền lại các ô (trừ mật khẩu), dán địa chỉ RTSP để tách ô, chọn đường dẫn theo hãng
function CameraSourceEditor({
  cameraId,
  view,
  onClose,
  onSaved,
}: {
  cameraId: string
  view: CameraSourceView
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const palette = usePalette()
  const updateSource = useUpdateCameraSource()
  const [form, setForm] = useState<CameraSourceForm>(() => toCameraSourceForm(view.source))
  const [pasted, setPasted] = useState('')
  const [isPasteInvalid, setPasteInvalid] = useState(false)
  // Chỉ báo lỗi từng ô sau lần bấm Lưu đầu tiên, để form trống không đỏ ngay khi mở
  const [isSubmitted, setSubmitted] = useState(false)
  const errors = validateCameraSource(form)
  const hasErrors = Object.keys(errors).length > 0
  const hasSavedPassword = view.source?.has_password ?? false
  const fieldError = (field: CameraSourceField) => (isSubmitted ? (errors[field] ?? null) : null)
  const update = (patch: Partial<CameraSourceForm>) => setForm(current => ({ ...current, ...patch }))
  const presetPath = CAMERA_PATH_PRESETS.find(preset => preset.path === form.path)?.path ?? null

  // Tách được thì điền các ô rồi xoá ô dán: địa chỉ dán kèm mật khẩu không nằm lại trên màn hình
  const applyPaste = (text: string) => {
    const parsed = text.trim() ? parseRtspInput(text) : null
    setPasteInvalid(Boolean(text.trim()) && parsed === null)
    setPasted(parsed ? '' : text)
    if (parsed) setForm(parsed)
  }

  const save = () => {
    setSubmitted(true)
    if (hasErrors) return
    updateSource.mutate(
      { cameraId, payload: buildCameraSourcePayload(form, hasSavedPassword) },
      { onSuccess: () => onSaved(t('Đã lưu. Camera đếm chim mở lại luồng camera trong khoảng 1 phút.')) },
    )
  }

  return (
    <>
      <View style={styles.body}>
        <View style={[styles.status, { backgroundColor: palette.surfaceStrong }]}>
          <Text variant="small" color={palette.textSecondary}>
            {t('Tình trạng')}
          </Text>
          <Text
            variant="body"
            weight="semiBold"
            color={isCameraStatusProblem(view.camera_status) ? palette.alert : palette.text}
          >
            {getCameraStatusLabel(view.camera_status)}
          </Text>
          {view.camera_status_at && (
            <Text variant="small" color={palette.textSecondary}>
              {formatTimeAgo(view.camera_status_at)}
            </Text>
          )}
        </View>
        <TextField
          label={t('Dán địa chỉ RTSP (không bắt buộc)')}
          placeholder="rtsp://<tài khoản>:<mật khẩu>@203.0.113.7:554/stream1"
          value={pasted}
          onChangeText={applyPaste}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          error={isPasteInvalid ? t('Không phải địa chỉ RTSP. Kiểm tra lại hoặc nhập từng ô bên dưới.') : null}
        />
        <TextField
          label={t('Địa chỉ camera (IP công cộng của nhà yến hoặc tên miền)')}
          value={form.host}
          onChangeText={host => update({ host })}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          error={fieldError('host')}
        />
        <View style={styles.fieldRow}>
          <TextField
            label={t('Cổng')}
            value={form.port}
            onChangeText={port => update({ port })}
            keyboardType="number-pad"
            error={fieldError('port')}
            style={styles.port}
          />
          <TextField
            label={t('Tài khoản')}
            value={form.username}
            onChangeText={username => update({ username })}
            autoCapitalize="none"
            autoCorrect={false}
            error={fieldError('username')}
            style={styles.flex}
          />
        </View>
        <TextField
          label={t('Mật khẩu')}
          placeholder={hasSavedPassword ? t('Để trống để giữ mật khẩu đã lưu') : t('Mật khẩu')}
          value={form.password}
          onChangeText={password => update({ password })}
          isPassword
          autoCapitalize="none"
          autoCorrect={false}
          error={fieldError('password')}
        />
        <Text variant="small" weight="semiBold" color={palette.textSecondary}>
          {t('Đường dẫn theo hãng')}
        </Text>
        <ChoiceChips
          options={CAMERA_PATH_PRESETS.map(preset => ({ id: preset.path, label: preset.brand }))}
          selectedId={presetPath}
          onSelect={path => update({ path })}
          placement="card"
          accessibilityLabel={t('Đường dẫn theo hãng')}
        />
        <TextField
          label={t('Đường dẫn luồng (hãng khác: xem hướng dẫn RTSP của camera)')}
          value={form.path}
          onChangeText={path => update({ path })}
          autoCapitalize="none"
          autoCorrect={false}
          error={fieldError('path')}
        />
        <View style={styles.row}>
          <LockSimpleIcon size={14} color={palette.textSecondary} />
          <Text variant="small" color={palette.textSecondary} style={styles.flex}>
            {t('Mật khẩu được mã hoá khi lưu và không bao giờ hiện lại.')}
          </Text>
        </View>
      </View>
      <FormMessage
        message={
          updateSource.error
            ? getSettingsErrorMessage(updateSource.error, {
                503: t('Máy chủ chưa sẵn sàng lưu mật khẩu camera. Báo quản trị viên'),
              })
            : null
        }
      />
      <Button
        label={t('Lưu')}
        onPress={save}
        loading={updateSource.isPending}
        disabled={isSubmitted && hasErrors}
      />
      <Button label={t('Huỷ')} variant="link" onPress={onClose} disabled={updateSource.isPending} style={styles.center} />
    </>
  )
}

// Sheet "Cài đặt camera" của Farm Owner (FARM-FR-004b): địa chỉ camera IP ở cửa nhà yến mà camera đếm chim tự lấy về, kèm tình
// trạng camera do camera đếm chim báo. Mật khẩu mã hoá ở backend, không bao giờ hiện lại
export function CameraSourceSheet({ target, onClose, onSaved }: CameraSourceSheetProps) {
  const palette = usePalette()
  const sourceQuery = useCameraSource(target?.cameraId ?? null)
  if (!target) return null

  const renderBody = () => {
    if (sourceQuery.isLoading) return <Skeleton width="100%" height={SKELETON_HEIGHT} radius={Radius.md} />
    if (sourceQuery.isError || !sourceQuery.data) {
      return (
        <EmptyState
          message={t('Không tải được địa chỉ camera')}
          actionLabel={t('Thử lại')}
          onAction={() => sourceQuery.refetch()}
        />
      )
    }
    return <CameraSourceEditor cameraId={target.cameraId} view={sourceQuery.data} onClose={onClose} onSaved={onSaved} />
  }

  return (
    <BottomSheet visible onClose={onClose}>
      <Text variant="heading">{t('Cài đặt camera {device}', { device: target.deviceId })}</Text>
      <Text variant="small" color={palette.textSecondary}>
        {t('Địa chỉ camera IP ở cửa nhà yến. Camera đếm chim tự lấy địa chỉ này, không cần sửa gì trên máy đếm chim.')}
      </Text>
      {renderBody()}
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  body: { gap: Spacing.md },
  status: { borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  fieldRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  port: { width: PORT_FIELD_WIDTH },
  flex: { flex: 1 },
  center: { alignSelf: 'center' },
})

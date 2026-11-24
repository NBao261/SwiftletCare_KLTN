import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { ChoiceChips } from '@/components/analytics/ChoiceChips'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/form-message'
import { Text } from '@/components/ui/text'
import { TextField } from '@/components/ui/text-field'
import { Spacing } from '@/constants/theme'
import { useAllHouses } from '@/hooks/farm/useAllHouses'
import { useFarms } from '@/hooks/farm/useFarms'
import { usePalette } from '@/hooks/theme/usePalette'
import { useCreateWorkOrder } from '@/hooks/work-order/useCreateWorkOrder'
import type { WorkOrder } from '@/types'
import { getSettingsErrorMessage } from '@/utils/apiError.utils'
import { t } from '@/utils/i18n.utils'

// Tiêu đề tối đa 200, mô tả tối đa 2000 ký tự (Report 3 §4.5)
const TITLE_MAX_LENGTH = 200
const DESCRIPTION_MAX_LENGTH = 2000

// Điền sẵn khi mở từ một cảnh báo: nhà của cảnh báo (khoá) và tiêu đề theo loại cảnh báo
export interface WorkOrderCreatePrefill {
  houseId?: string
  alertId?: string
  title?: string
}

interface WorkOrderCreateSheetProps {
  visible: boolean
  prefill: WorkOrderCreatePrefill
  onCreated: (workOrder: WorkOrder) => void
  onClose: () => void
}

// Chủ trại mở phiếu công việc sửa chữa bằng tay (OPS-FR-001): chọn nhà, tiêu đề, mô tả. Backend giao cho kỹ thuật viên đang trực
// của nhà, nhà chưa có kỹ thuật viên thì chủ trại tự xử lý. Mở từ cảnh báo thì gắn cảnh báo, nhà không đổi được
export function WorkOrderCreateSheet({ visible, prefill, onCreated, onClose }: WorkOrderCreateSheetProps) {
  const palette = usePalette()
  const housesQuery = useAllHouses()
  const farmsQuery = useFarms()
  const createWorkOrder = useCreateWorkOrder()
  const [houseId, setHouseId] = useState<string | null>(prefill.houseId ?? null)
  const [title, setTitle] = useState(prefill.title ?? '')
  const [description, setDescription] = useState('')
  const isHouseLocked = Boolean(prefill.alertId && prefill.houseId)
  const farms = farmsQuery.data?.data ?? []
  const farmNameById = new Map(farms.map(farm => [farm._id, farm.name]))
  const houseOptions = housesQuery.houses.map(house => ({
    id: house._id,
    // Thuộc từ 2 farm thì ghi kèm tên farm để không nhầm nhà trùng tên
    label: farms.length > 1 ? `${farmNameById.get(house.farm_id) ?? ''} · ${house.name}` : house.name,
  }))
  const lockedHouseName = housesQuery.houses.find(house => house._id === houseId)?.name ?? '_'
  const canSubmit = Boolean(houseId) && title.trim() !== ''

  const closeUnlessBusy = () => {
    if (!createWorkOrder.isPending) onClose()
  }

  const submit = () => {
    if (!houseId || !canSubmit) return
    createWorkOrder.mutate(
      { houseId, title: title.trim(), description: description.trim(), alertId: prefill.alertId },
      { onSuccess: onCreated },
    )
  }

  const error = createWorkOrder.error
    ? getSettingsErrorMessage(createWorkOrder.error, { 409: t('Cảnh báo này đã có phiếu công việc đang mở') })
    : null

  return (
    <BottomSheet visible={visible} onClose={closeUnlessBusy}>
      <Text variant="heading">{t('Mở phiếu công việc')}</Text>
      <Text variant="small" color={palette.textSecondary}>
        {t('Phiếu giao cho kỹ thuật viên đang trực của nhà; nhà chưa có kỹ thuật viên thì chủ trại tự xử lý.')}
      </Text>
      <View style={styles.field}>
        <Text variant="small" weight="semiBold" color={palette.textSecondary}>
          {t('Nhà yến')}
        </Text>
        {isHouseLocked ? (
          <Text variant="body" weight="semiBold">
            {lockedHouseName}
          </Text>
        ) : houseOptions.length === 0 ? (
          <Text variant="small" color={palette.textSecondary}>
            {housesQuery.isLoading ? t('Đang tải') : t('Chưa có nhà yến')}
          </Text>
        ) : (
          <ChoiceChips
            options={houseOptions}
            selectedId={houseId}
            onSelect={setHouseId}
            placement="card"
            disabled={createWorkOrder.isPending}
            accessibilityLabel={t('Chọn nhà yến')}
          />
        )}
      </View>
      <TextField
        label={t('Tiêu đề')}
        value={title}
        onChangeText={setTitle}
        maxLength={TITLE_MAX_LENGTH}
        editable={!createWorkOrder.isPending}
      />
      <TextField
        label={t('Mô tả việc cần làm (không bắt buộc)')}
        value={description}
        onChangeText={setDescription}
        maxLength={DESCRIPTION_MAX_LENGTH}
        multiline
        editable={!createWorkOrder.isPending}
      />
      <FormMessage message={error} />
      <Button
        label={t('Mở phiếu')}
        onPress={submit}
        disabled={!canSubmit}
        loading={createWorkOrder.isPending}
      />
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  field: { gap: Spacing.sm },
})

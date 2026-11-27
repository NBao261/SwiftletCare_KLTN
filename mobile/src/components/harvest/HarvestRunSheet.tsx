import { useState } from 'react'
import { Alert as NativeAlert, StyleSheet, View } from 'react-native'
import { CaretLeftIcon, CaretRightIcon } from 'phosphor-react-native'
import { PhotoCaptureField } from '@/components/common/PhotoCaptureField'
import { SettingsEditActions } from '@/components/farm/settings/SettingsEditActions'
import { SettingsTable } from '@/components/farm/settings/SettingsTable'
import { HarvestRunPhoto } from '@/components/harvest/HarvestRunPhoto'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Text } from '@/components/ui/text'
import { Radius, Spacing } from '@/constants/theme'
import { useConfirmHarvestRun } from '@/hooks/harvest/useConfirmHarvestRun'
import { useDeleteHarvestRun } from '@/hooks/harvest/useDeleteHarvestRun'
import { type HarvestOperationResult, useSaveHarvestRun } from '@/hooks/harvest/useSaveHarvestRun'
import { useUploadHarvestPhoto } from '@/hooks/harvest/useUploadHarvestPhoto'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import type { HarvestBatch, LocalPhoto, NestType } from '@/types'
import { getSettingsErrorMessage } from '@/utils/apiError.utils'
import { formatVietnamDateOf, getVietnamDate } from '@/utils/date.utils'
import {
  checkNestAmount,
  getRunBatchIdsAfterSave,
  HARVEST_DATE_MIN,
  HARVEST_GRAMS_MAX_DECIMALS,
  limitAmountInput,
  NEST_TYPES,
  planHarvestRunOperations,
  toHarvestDateIso,
  type HarvestRun,
  type NestAmountText,
} from '@/utils/harvest.utils'
import { shiftDate } from '@/utils/healthDay.utils'
import { getNestTypeLabel } from '@/utils/label.utils'
import { formatDecimal } from '@/utils/number.utils'
import { canPerform } from '@/utils/permission.utils'
import { toInputText } from '@/utils/settingsValidation.utils'
import { t } from '@/utils/i18n.utils'

const GRAMS_PER_KILOGRAM = 1000
const KILOGRAM_DIGITS = 2

// Lần bấm trước chỉ lưu được một phần: giữ ngày đã ghi và đợt đã lưu (null = đã xoá) để lần sau không tạo trùng — như web
interface PartialSave {
  harvestDateIso: string
  batchByType: Partial<Record<NestType, HarvestBatch | null>>
}

interface HarvestRunSheetProps {
  visible: boolean
  farmId: string
  houseName: string
  // Zone gắn lần thu mới: zone tạo sớm nhất của nhà — sản lượng ghi theo nhà, người dùng không chọn zone (như web)
  zoneId: string
  // null: ghi lần thu mới; có thì sửa lần thu đó (màn chỉ mở khi canEditHarvestRun)
  run: HarvestRun | null
  onDone: (message: string) => void
  onClose: () => void
}

// Số liệu ban đầu: sửa thì lấy từ các đợt của lần thu, ghi mới thì để trống. Dấu thập phân theo ngôn ngữ (toInputText):
// tiếng Việt mà để "2.125" g thì bị hiểu là dấu ngăn nghìn và không lưu được
function initialAmounts(run: HarvestRun | null): Record<NestType, NestAmountText> {
  const amountOf = (nestType: NestType): NestAmountText => {
    const batch = run?.batchByType[nestType]
    return batch ? { nests: String(batch.nest_count), grams: toInputText(batch.weight_grams) } : { nests: '', grams: '' }
  }
  return { RAW: amountOf('RAW'), CLEANED: amountOf('CLEANED'), PREMIUM: amountOf('PREMIUM') }
}

// Sheet ghi / sửa một lần thu (HARVEST-FR-001, 005; SF-04): ngày thu, số tổ và khối lượng của 3 loại yến, cùng khung form tạo mới
// của trang cài đặt (MOBILE_GUIDE 3.10). Mỗi loại có số là một đợt cùng zone, cùng ngày; chủ trại ghi là xác nhận ngay, kỹ thuật
// viên ghi thì chờ chủ trại xác nhận (HARVEST-FR-006)
export function HarvestRunSheet({ visible, farmId, houseName, zoneId, run, onDone, onClose }: HarvestRunSheetProps) {
  const palette = usePalette()
  const user = useAuthStore(state => state.user)
  const saveRun = useSaveHarvestRun(farmId)
  const deleteRun = useDeleteHarvestRun(farmId)
  const confirmRun = useConfirmHarvestRun(farmId)
  const uploadPhoto = useUploadHarvestPhoto()
  const today = getVietnamDate()
  const [harvestDate, setHarvestDate] = useState(today)
  const [amounts, setAmounts] = useState(() => initialAmounts(run))
  const [partialSave, setPartialSave] = useState<PartialSave | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Ảnh vừa chụp, gửi sau khi lưu số (HARVEST-FR-001); một lần thu một ảnh, ảnh mới thay ảnh cũ
  const [photos, setPhotos] = useState<LocalPhoto[]>([])
  const isEdit = run !== null
  const isBusy = saveRun.isPending || deleteRun.isPending || confirmRun.isPending || uploadPhoto.isPending
  // Sửa hoặc đã lưu một phần thì ngày thu cố định (PUT không đổi được ngày)
  const isDateLocked = isEdit || partialSave !== null
  const canGoEarlier = harvestDate > HARVEST_DATE_MIN
  const canGoLater = harvestDate < today
  const harvestDateIso = run?.harvest_date ?? partialSave?.harvestDateIso ?? toHarvestDateIso(harvestDate)

  // Đợt đang có = đợt của lần thu, cộng đợt đã tạo / bỏ đợt đã xoá ở lần bấm trước lỗi một phần
  const existing: Partial<Record<NestType, HarvestBatch>> = {}
  for (const nestType of NEST_TYPES) {
    const saved = partialSave?.batchByType[nestType]
    const batch = saved === undefined ? run?.batchByType[nestType] : saved
    if (batch) existing[nestType] = batch
  }
  const checks = {
    RAW: checkNestAmount(amounts.RAW),
    CLEANED: checkNestAmount(amounts.CLEANED),
    PREMIUM: checkNestAmount(amounts.PREMIUM),
  }
  const filledTypes = NEST_TYPES.filter(nestType => checks[nestType].isFilled)
  const hasRowError = NEST_TYPES.some(nestType => checks[nestType].error !== null)
  const operations = planHarvestRunOperations({
    zoneId: run?.zone_id ?? zoneId,
    harvestDateIso,
    checks,
    existing,
    productImages: run?.product_images ?? [],
  })
  const totalNests = filledTypes.reduce((total, nestType) => total + checks[nestType].nests, 0)
  const totalGrams = filledTypes.reduce((total, nestType) => total + checks[nestType].grams, 0)
  const existingIds = NEST_TYPES.flatMap(nestType => existing[nestType]?._id ?? [])
  // Lần thu phải còn ít nhất một loại có số; muốn bỏ hết thì dùng "Xoá lần thu". Chỉ chụp ảnh mới cũng lưu được
  const hasChanges = operations.length > 0 || photos.length > 0
  const canSave = !hasRowError && filledTypes.length > 0 && hasChanges && Boolean(zoneId || run)

  const closeUnlessBusy = () => {
    if (!isBusy) onClose()
  }

  // Cắt ngay khi gõ: số tổ là số nguyên 6 chữ số, số gram 6 chữ số kèm tối đa 2 chữ số lẻ (số cũ dài hơn thì giữ độ dài đó)
  const setAmount = (nestType: NestType, field: keyof NestAmountText, value: string) => {
    const decimals = field === 'nests' ? 0 : HARVEST_GRAMS_MAX_DECIMALS
    setAmounts(current => {
      const limited = limitAmountInput(value, decimals, current[nestType][field])
      return { ...current, [nestType]: { ...current[nestType], [field]: limited } }
    })
  }

  // Gửi ảnh vừa chụp cho mọi đợt của lần thu sau khi lưu số; không có ảnh thì coi như xong
  const sendPhoto = async (results: HarvestOperationResult[]): Promise<boolean> => {
    const photo = photos[0]
    if (!photo) return true
    const saved: Partial<Record<NestType, HarvestBatch | null>> = {}
    for (const result of results) if (result.isSaved) saved[result.operation.nestType] = result.batch
    const harvestIds = getRunBatchIdsAfterSave(existing, saved)
    const failedCount = await uploadPhoto.mutateAsync({ harvestIds, photo }).catch(() => harvestIds.length)
    return failedCount === 0
  }

  const handleSave = async () => {
    if (!canSave) return
    setError(null)
    const results = operations.length > 0 ? await saveRun.mutateAsync(operations) : []
    const failures = results.flatMap(result => (result.isSaved ? [] : [result]))
    if (failures.length === 0) {
      // Lô vừa tạo là DRAFT: người ghi là kỹ thuật viên, lần thu chờ chủ trại xác nhận
      const isPending = results.some(
        result => result.isSaved && result.operation.kind === 'create' && result.batch?.status === 'DRAFT',
      )
      const message = isPending ? t('Đã lưu, chờ chủ trại xác nhận') : isEdit ? t('Đã cập nhật lần thu') : t('Đã ghi lần thu')
      const isPhotoSent = await sendPhoto(results)
      // Số đã lưu dù ảnh lỗi: báo để người dùng mở lại lần thu gửi ảnh lần nữa
      onDone(isPhotoSent ? message : t('{message}. Chưa gửi được ảnh, mở lại lần thu để gửi lại', { message }))
      return
    }
    // Ghi lại loại đã lưu được để lần bấm sau chỉ gửi lại loại lỗi, không tạo trùng đợt thu; chưa lưu được gì thì giữ nguyên
    if (results.some(result => result.isSaved)) {
      const batchByType = { ...partialSave?.batchByType }
      for (const result of results) if (result.isSaved) batchByType[result.operation.nestType] = result.batch
      setPartialSave({ harvestDateIso, batchByType })
    }
    const firstFailure = failures[0]
    setError(
      t('Chưa lưu được: {types}. {reason}', {
        types: failures.map(result => getNestTypeLabel(result.operation.nestType)).join(', '),
        reason: getSettingsErrorMessage(firstFailure.error, {
          422: t('Số liệu hoặc ngày thu không hợp lệ. Vui lòng kiểm tra lại'),
        }),
      }),
    )
  }

  const confirmDelete = () => {
    if (!run) return
    NativeAlert.alert(
      t('Xoá lần thu?'),
      t('Xoá lần thu ngày {date}? Lần thu đã xác nhận bị xoá thì chu kỳ thu hoạch của nó gộp vào chu kỳ sau.', {
        date: formatVietnamDateOf(run.harvest_date),
      }),
      [
        { text: t('Huỷ'), style: 'cancel' },
        {
          text: t('Xoá'),
          style: 'destructive',
          onPress: () => {
            setError(null)
            // Xoá cả đợt vừa tạo ở lần lưu lỗi một phần trước đó
            const harvestIds = NEST_TYPES.flatMap(nestType => existing[nestType]?._id ?? [])
            deleteRun.mutate(harvestIds, {
              onSuccess: () => onDone(t('Đã xoá lần thu')),
              onError: deleteError => setError(getSettingsErrorMessage(deleteError)),
            })
          },
        },
      ],
    )
  }

  // Đợt DRAFT của lần thu mà chủ trại xác nhận được (HARVEST-FR-006)
  const draftIds = NEST_TYPES.flatMap(nestType => {
    const batch = existing[nestType]
    return batch?.status === 'DRAFT' ? [batch._id] : []
  })
  const canConfirm = isEdit && draftIds.length > 0 && canPerform(user, 'confirmHarvest')
  // Đang sửa số hoặc vừa chụp ảnh mà chưa lưu thì phải lưu trước, để xác nhận đúng lần thu đang thấy
  const hasUnsavedChanges = hasChanges

  const confirmPending = () => {
    if (!run) return
    NativeAlert.alert(
      t('Xác nhận lần thu?'),
      t('Lần thu ngày {date} sẽ được tính vào sản lượng và đóng chu kỳ thu hoạch của khu vực.', {
        date: formatVietnamDateOf(run.harvest_date),
      }),
      [
        { text: t('Huỷ'), style: 'cancel' },
        {
          text: t('Xác nhận'),
          onPress: () => {
            setError(null)
            confirmRun.mutate(draftIds, {
              onSuccess: () => onDone(t('Đã xác nhận lần thu')),
              onError: confirmError =>
                setError(getSettingsErrorMessage(confirmError, { 409: t('Lần thu đã được xác nhận trước đó') })),
            })
          },
        },
      ],
    )
  }

  const hint = isDateLocked
    ? t('Ngày thu không đổi được sau khi tạo; muốn đổi thì xoá lần thu này và tạo lại.')
    : t('Chỉ nhập số liệu cho loại yến thu hoạch thực tế. Các ô để trống sẽ mặc định là 0.')

  return (
    <BottomSheet visible={visible} onClose={closeUnlessBusy}>
      <View style={styles.header}>
        <Text variant="heading" style={styles.flex}>
          {isEdit ? t('Sửa lần thu') : t('Ghi lần thu')}
        </Text>
        <Text
          variant="small"
          weight="semiBold"
          color={palette.textSecondary}
          style={[styles.overline, styles.scopeLabel]}
          numberOfLines={1}
        >
          {houseName}
        </Text>
      </View>
      <View style={styles.body}>
        <View style={styles.field}>
          <Text variant="small" weight="semiBold" color={palette.textSecondary} style={styles.overline}>
            {t('Ngày thu')}
          </Text>
          {isDateLocked ? (
            <Text variant="body" weight="semiBold">
              {formatVietnamDateOf(harvestDateIso)}
            </Text>
          ) : (
            <View style={[styles.dateRow, { backgroundColor: palette.surfaceStrong }]}>
              {/* IconButton không tự mờ khi khoá: mờ 0,5 như nút bị khoá (MOBILE_GUIDE 3.5) để thấy đã tới mốc */}
              <View style={!canGoEarlier && styles.disabled}>
                <IconButton
                  icon={CaretLeftIcon}
                  label={t('Ngày trước')}
                  onPress={canGoEarlier ? () => setHarvestDate(shiftDate(harvestDate, -1)) : undefined}
                />
              </View>
              <Text variant="body" weight="semiBold" center style={styles.flex} accessibilityLiveRegion="polite">
                {harvestDate === today
                  ? t('{date} · Hôm nay', { date: formatVietnamDateOf(harvestDateIso) })
                  : formatVietnamDateOf(harvestDateIso)}
              </Text>
              {/* Backend chặn ngày sau hôm nay theo giờ Việt Nam (HARVEST-FR-001) */}
              <View style={!canGoLater && styles.disabled}>
                <IconButton
                  icon={CaretRightIcon}
                  label={t('Ngày sau')}
                  onPress={canGoLater ? () => setHarvestDate(shiftDate(harvestDate, 1)) : undefined}
                />
              </View>
            </View>
          )}
        </View>
        <View style={styles.field}>
          <Text variant="small" weight="semiBold" color={palette.textSecondary} style={styles.overline}>
            {t('Sản lượng theo loại yến')}
          </Text>
          <SettingsTable
            columns={[
              { label: t('Loại yến'), flex: 1.2 },
              { label: t('Số tổ'), align: 'right' },
              { label: t('Trọng lượng (g)'), align: 'right' },
            ]}
            rows={NEST_TYPES.map(nestType => {
              const typeLabel = getNestTypeLabel(nestType)
              return {
                id: nestType,
                cells: [
                  { text: typeLabel },
                  {
                    input: {
                      value: amounts[nestType].nests,
                      onChangeText: value => setAmount(nestType, 'nests', value),
                      label: `${typeLabel}, ${t('Số tổ')}`,
                      placeholder: '0',
                      keyboardType: 'number-pad',
                      hasError: checks[nestType].error !== null,
                      editable: !isBusy,
                    },
                  },
                  {
                    input: {
                      value: amounts[nestType].grams,
                      onChangeText: value => setAmount(nestType, 'grams', value),
                      label: `${typeLabel}, ${t('Trọng lượng (g)')}`,
                      placeholder: '0',
                      keyboardType: 'decimal-pad',
                      hasError: checks[nestType].error !== null,
                      editable: !isBusy,
                    },
                  },
                ],
                error: checks[nestType].error,
              }
            })}
          />
          <Text variant="body" weight="semiBold">
            {t('Tổng: {nests} tổ · {kilograms} kg', {
              nests: formatDecimal(totalNests),
              kilograms: formatDecimal(totalGrams / GRAMS_PER_KILOGRAM, KILOGRAM_DIGITS),
            })}
          </Text>
        </View>
        <View style={styles.field}>
          <Text variant="small" weight="semiBold" color={palette.textSecondary} style={styles.overline}>
            {t('Ảnh lần thu')}
          </Text>
          {isEdit && photos.length === 0 && <HarvestRunPhoto harvestIds={existingIds} />}
          <PhotoCaptureField photos={photos} onChange={setPhotos} maxPhotos={1} disabled={isBusy} />
          {isEdit && (
            <Text variant="small" color={palette.textSecondary}>
              {t('Ảnh mới chụp sẽ thay ảnh đang có khi bấm Cập nhật.')}
            </Text>
          )}
        </View>
        <Text variant="small" color={palette.textSecondary}>
          {hint}
        </Text>
        {/* Lô của kỹ thuật viên là DRAFT, chỉ tính vào sản lượng sau khi chủ trại xác nhận (BR-43) */}
        {!canPerform(user, 'editAnyHarvest') && (
          <Text variant="small" color={palette.textSecondary}>
            {t('Lần thu bạn ghi chờ chủ trại xác nhận rồi mới tính vào sản lượng.')}
          </Text>
        )}
      </View>
      {canConfirm && (
        <View style={styles.field}>
          <Button
            label={t('Xác nhận lần thu')}
            size="md"
            onPress={confirmPending}
            loading={confirmRun.isPending}
            disabled={hasUnsavedChanges || isBusy}
          />
          <Text variant="small" color={palette.textSecondary}>
            {hasUnsavedChanges
              ? t('Lưu thay đổi trước khi xác nhận')
              : t('Kỹ thuật viên đã ghi lần thu này, chờ bạn xác nhận')}
          </Text>
        </View>
      )}
      <SettingsEditActions
        label={isEdit ? t('Cập nhật') : t('Tạo mới')}
        onSave={handleSave}
        onCancel={closeUnlessBusy}
        isSaving={saveRun.isPending || uploadPhoto.isPending}
        isSaveDisabled={!canSave || deleteRun.isPending || confirmRun.isPending}
        error={error}
      />
      {isEdit && (
        <Button
          label={t('Xoá lần thu')}
          variant="link"
          color={palette.alert}
          onPress={confirmDelete}
          loading={deleteRun.isPending}
          disabled={saveRun.isPending || confirmRun.isPending || uploadPhoto.isPending}
          style={styles.center}
        />
      )}
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1 },
  overline: { textTransform: 'uppercase', letterSpacing: 1 },
  scopeLabel: { maxWidth: '45%' },
  body: { gap: Spacing.lg },
  field: { gap: Spacing.sm },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: Radius.md, padding: Spacing.xs },
  center: { alignSelf: 'center' },
  disabled: { opacity: 0.5 },
})

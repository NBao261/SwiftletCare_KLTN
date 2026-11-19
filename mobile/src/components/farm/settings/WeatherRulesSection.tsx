import { useState } from 'react'
import { CloudSunIcon } from 'phosphor-react-native'
import { SettingsEditActions } from '@/components/farm/settings/SettingsEditActions'
import { SettingsSection } from '@/components/farm/settings/SettingsSection'
import { SettingsList, SettingsListRow } from '@/components/farm/settings/SettingsListRow'
import { WeatherRuleSheet } from '@/components/farm/settings/WeatherRuleSheet'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text'
import type { SectionEditor } from '@/hooks/farm/useSingleSectionEdit'
import { useFarmHasExpert } from '@/hooks/farm/useFarmHasExpert'
import { useUpdateWeatherRules } from '@/hooks/farm/useUpdateWeatherRules'
import { useWeatherRules } from '@/hooks/farm/useWeatherRules'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import type { House, WeatherRule, WeatherRulesView } from '@/types'
import { getSettingsErrorMessage } from '@/utils/apiError.utils'
import { formatVietnamTime } from '@/utils/date.utils'
import { getWeatherMetricLabel } from '@/utils/label.utils'
import { canPerform } from '@/utils/permission.utils'
import { getSettingsSectionId, getViewOnlyNote } from '@/utils/settingsSection.utils'
import { formatStoredNumber, MAX_WEATHER_RULES } from '@/utils/settingsValidation.utils'
import { t } from '@/utils/i18n.utils'

const SECTION_SKELETON_HEIGHT = 72

interface WeatherRulesSectionProps {
  house: House
  editor: SectionEditor
  onSaved: (message: string) => void
}

// Điều kiện của luật: "Nhiệt độ cao nhất dự báo ≥ 33 °C"
function formatCondition(rule: WeatherRule): string {
  const { label, unit } = getWeatherMetricLabel(rule.metric)
  return `${label} ≥ ${formatStoredNumber(rule.min)} ${unit}`
}

// Mức bù của luật: "Bù +5 % · 30 phút"
function formatOffset(rule: WeatherRule): string {
  const sign = rule.offset_pct > 0 ? '+' : ''
  return t('Bù {offset} % · {minutes} phút', { offset: `${sign}${formatStoredNumber(rule.offset_pct)}`, minutes: rule.duration_min })
}

// Danh sách luật; onPress chỉ có khi đang sửa
function RuleList({ rules, onPress }: { rules: WeatherRule[]; onPress?: (index: number) => void }) {
  return (
    <SettingsList isEmpty={rules.length === 0} emptyText={t('Chưa có luật nào')}>
      {rules.map((rule, index) => (
        <SettingsListRow
          key={rule._id ?? `new-${index}`}
          title={formatCondition(rule)}
          trailing={rule.active ? t('Bật') : t('Tắt')}
          isTrailingMuted={!rule.active}
          caption={formatOffset(rule)}
          hasDivider={index > 0}
          onPress={onPress ? () => onPress(index) : undefined}
        />
      ))}
    </SettingsList>
  )
}

// Phần đang sửa: bản nháp danh sách luật, chạm một luật để sửa hoặc xoá, thêm luật mới; Cập nhật gửi cả danh sách
function WeatherRulesEditor({
  house,
  view,
  editor,
  onSaved,
  startWithAdd,
}: WeatherRulesSectionProps & { view: WeatherRulesView; startWithAdd: boolean }) {
  const [rules, setRules] = useState<WeatherRule[]>(view.rules)
  // Sheet đang mở: null đóng, 'new' thêm, số là vị trí luật đang sửa; bấm "Thêm luật" khi đang xem thì mở sẵn sheet thêm
  const [sheetTarget, setSheetTarget] = useState<number | 'new' | null>(startWithAdd ? 'new' : null)
  const [error, setError] = useState<string | null>(null)
  const updateWeatherRules = useUpdateWeatherRules()
  const isChanged = JSON.stringify(rules) !== JSON.stringify(view.rules)

  const applyRules = (next: WeatherRule[]) => {
    setRules(next)
    editor.setDirty(JSON.stringify(next) !== JSON.stringify(view.rules))
    setSheetTarget(null)
  }

  const submit = () => {
    setError(null)
    updateWeatherRules.mutate(
      { houseId: house._id, rules },
      {
        onSuccess: () => {
          editor.finishEditing()
          onSaved(t('Đã lưu luật bù thời tiết'))
        },
        onError: saveError => setError(getSettingsErrorMessage(saveError)),
      },
    )
  }

  const editingRule = typeof sheetTarget === 'number' ? rules[sheetTarget] : null

  return (
    <>
      <RuleList rules={rules} onPress={setSheetTarget} />
      <Button
        label={t('Thêm luật ({count}/{max})', { count: rules.length, max: MAX_WEATHER_RULES })}
        variant="outline"
        size="md"
        onPress={() => setSheetTarget('new')}
        disabled={rules.length >= MAX_WEATHER_RULES}
      />
      <SettingsEditActions
        onSave={submit}
        onCancel={editor.cancelEditing}
        isSaving={updateWeatherRules.isPending}
        isSaveDisabled={!isChanged}
        error={error}
      />
      {sheetTarget !== null && (
        <WeatherRuleSheet
          initial={editingRule}
          onSubmit={rule =>
            applyRules(
              typeof sheetTarget === 'number'
                ? rules.map((item, index) => (index === sheetTarget ? rule : item))
                : [...rules, rule],
            )
          }
          onDelete={
            typeof sheetTarget === 'number' ? () => applyRules(rules.filter((_, index) => index !== sheetTarget)) : undefined
          }
          onClose={() => setSheetTarget(null)}
        />
      )}
    </>
  )
}

// Mục "Bù phun sương theo thời tiết" của nhà (ENV-FR-030, BR-38): dự báo 2 giờ tới thoả luật thì cộng (hoặc trừ) vài điểm % vào
// mức phun trong một thời hạn; không bao giờ đổi quạt hay lệnh tay. Chuyên gia sửa; farm chưa có chuyên gia thì chủ trại sửa thay
// (BR-22); kỹ thuật viên của nhà chỉ xem
export function WeatherRulesSection({ house, editor, onSaved }: WeatherRulesSectionProps) {
  const palette = usePalette()
  const user = useAuthStore(state => state.user)
  const hasExpert = useFarmHasExpert(house.farm_id)
  const canEdit = canPerform(user, 'editWeatherRules', { farmHasExpert: hasExpert })
  const viewOnlyNote = canEdit ? null : getViewOnlyNote(canPerform(user, 'editWeatherRules', { farmHasExpert: false }), hasExpert)
  const rulesQuery = useWeatherRules(house._id)
  const id = getSettingsSectionId('weather')
  const isEditing = editor.isEditing(id)
  const [startWithAdd, setStartWithAdd] = useState(false)

  // Thêm ngay từ chế độ xem: mở chế độ sửa rồi mở sheet thêm luật
  const startAdding = () => {
    setStartWithAdd(true)
    editor.startEditing(id)
  }

  // Bấm "Sửa": vào chế độ sửa, không mở sẵn sheet
  const startEditing = () => {
    setStartWithAdd(false)
    editor.startEditing(id)
  }

  if (rulesQuery.isLoading) return <Skeleton width="100%" height={SECTION_SKELETON_HEIGHT} />
  if (rulesQuery.isError || !rulesQuery.data) {
    return (
      <EmptyState
        message={t('Không tải được luật bù thời tiết')}
        actionLabel={t('Thử lại')}
        onAction={() => rulesQuery.refetch()}
      />
    )
  }
  const view = rulesQuery.data
  const last = view.last_compensation

  return (
    <SettingsSection
      icon={CloudSunIcon}
      title={t('Bù phun sương theo thời tiết')}
      subtitle={view.rules.length > 0 ? t('{count} luật', { count: view.rules.length }) : t('Chưa có luật nào')}
      scopeLabel={t('Nhà')}
      isExpanded={editor.isExpanded(id)}
      onToggle={() => editor.toggle(id)}
      onEdit={canEdit ? startEditing : undefined}
      isEditing={isEditing}
      footerNote={canEdit ? t('Mức bù từ −10 đến +10 điểm %, chỉ áp cho phun sương') : undefined}
    >
      {isEditing ? (
        <WeatherRulesEditor house={house} view={view} editor={editor} onSaved={onSaved} startWithAdd={startWithAdd} />
      ) : (
        <>
          <RuleList rules={view.rules} />
          <Text variant="small" color={palette.textSecondary}>
            {last
              ? t('Lần bù gần nhất: {offset} % lúc {sent}, hết hạn {expires}', {
                  offset: `${last.offset_pct > 0 ? '+' : ''}${formatStoredNumber(last.offset_pct)}`,
                  sent: formatVietnamTime(last.sent_at),
                  expires: formatVietnamTime(last.expires_at),
                })
              : t('Chưa bù lần nào')}
          </Text>
          {canEdit ? (
            <Button
              label={t('Thêm luật ({count}/{max})', { count: view.rules.length, max: MAX_WEATHER_RULES })}
              variant="outline"
              size="md"
              onPress={startAdding}
              disabled={view.rules.length >= MAX_WEATHER_RULES}
            />
          ) : viewOnlyNote ? (
            <Text variant="small" color={palette.textSecondary}>
              {viewOnlyNote}
            </Text>
          ) : null}
        </>
      )}
    </SettingsSection>
  )
}

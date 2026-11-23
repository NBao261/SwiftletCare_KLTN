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
import { useProposeWeatherRules } from '@/hooks/farm/useProposeWeatherRules'
import { useUpdateWeatherRules } from '@/hooks/farm/useUpdateWeatherRules'
import { useWeatherRules } from '@/hooks/farm/useWeatherRules'
import { usePalette } from '@/hooks/theme/usePalette'
import { useAuthStore } from '@/stores/authStore'
import type { House, WeatherRule, WeatherRulesView } from '@/types'
import { getSettingsErrorMessage } from '@/utils/apiError.utils'
import { formatDateTime, formatVietnamTime } from '@/utils/date.utils'
import { getWeatherMetricLabel } from '@/utils/label.utils'
import { canPerform } from '@/utils/permission.utils'
import { getSettingsSectionId, joinFooterNotes } from '@/utils/settingsSection.utils'
import { formatStoredNumber, MAX_WEATHER_RULES } from '@/utils/settingsValidation.utils'
import { t } from '@/utils/i18n.utils'

const SECTION_SKELETON_HEIGHT = 72

// Lưu thẳng (chuyên gia, chủ trại trên farm chưa có chuyên gia) hay gửi chuyên gia duyệt (chủ trại trên farm có chuyên gia, BR-22)
type WeatherRulesSaveMode = 'save' | 'propose'

// Bản nháp bắt đầu từ đâu: đề xuất đang chờ (để chủ trại sửa tiếp) hay luật đang chạy
function getStartingRules(view: WeatherRulesView, mode: WeatherRulesSaveMode): WeatherRule[] {
  return mode === 'propose' ? (view.proposal?.rules ?? view.rules) : view.rules
}

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

// Phần đang sửa: bản nháp danh sách luật, chạm một luật để sửa hoặc xoá, thêm luật mới; Cập nhật gửi cả danh sách. Chế độ đề xuất
// bắt đầu từ đề xuất đang chờ (nếu có) để chủ trại sửa tiếp, gửi lại thì thay đề xuất cũ
function WeatherRulesEditor({
  house,
  view,
  editor,
  onSaved,
  startWithAdd,
  mode,
}: WeatherRulesSectionProps & { view: WeatherRulesView; startWithAdd: boolean; mode: WeatherRulesSaveMode }) {
  const initialRules = getStartingRules(view, mode)
  const [rules, setRules] = useState<WeatherRule[]>(initialRules)
  // Sheet đang mở: null đóng, 'new' thêm, số là vị trí luật đang sửa; bấm "Thêm luật" khi đang xem thì mở sẵn sheet thêm
  const [sheetTarget, setSheetTarget] = useState<number | 'new' | null>(startWithAdd ? 'new' : null)
  const [error, setError] = useState<string | null>(null)
  const updateWeatherRules = useUpdateWeatherRules()
  const proposeWeatherRules = useProposeWeatherRules()
  const isChanged = JSON.stringify(rules) !== JSON.stringify(initialRules)
  const isSaving = updateWeatherRules.isPending || proposeWeatherRules.isPending

  const applyRules = (next: WeatherRule[]) => {
    setRules(next)
    editor.setDirty(JSON.stringify(next) !== JSON.stringify(initialRules))
    setSheetTarget(null)
  }

  const submit = () => {
    setError(null)
    const callbacks = {
      onSuccess: () => {
        editor.finishEditing()
        onSaved(mode === 'propose' ? t('Đã gửi chuyên gia duyệt') : t('Đã lưu luật bù thời tiết'))
      },
      // 409 khi gửi đề xuất: farm vừa không còn chuyên gia, mục tải lại và chuyển sang lưu thẳng
      onError: (saveError: unknown) =>
        setError(getSettingsErrorMessage(saveError, { 409: t('Trang trại không còn chuyên gia. Bạn đặt luật trực tiếp được') })),
    }
    if (mode === 'propose') {
      proposeWeatherRules.mutate({ houseId: house._id, rules }, callbacks)
      return
    }
    updateWeatherRules.mutate({ houseId: house._id, rules }, callbacks)
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
        isSaving={isSaving}
        isSaveDisabled={!isChanged}
        error={error}
        label={mode === 'propose' ? t('Gửi chuyên gia duyệt') : undefined}
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
// mức phun trong một thời hạn; không bao giờ đổi quạt hay lệnh tay. Chuyên gia đặt; farm chưa có chuyên gia thì chủ trại đặt thay,
// có thì chủ trại gửi đề xuất và luật chỉ chạy khi chuyên gia duyệt (BR-22 nhóm B); kỹ thuật viên của nhà chỉ xem
export function WeatherRulesSection({ house, editor, onSaved }: WeatherRulesSectionProps) {
  const palette = usePalette()
  const user = useAuthStore(state => state.user)
  const hasExpert = useFarmHasExpert(house.farm_id)
  const canEdit = canPerform(user, 'editWeatherRules', { farmHasExpert: hasExpert })
  const canPropose = canPerform(user, 'proposeWeatherRules', { farmHasExpert: hasExpert })
  const canChange = canEdit || canPropose
  const mode: WeatherRulesSaveMode = canEdit ? 'save' : 'propose'
  // Chỉ xem: role không bao giờ đặt luật (kỹ thuật viên); chủ trại lúc chưa biết farm có chuyên gia thì chưa ghi gì
  const isViewOnly = !canChange && !canPerform(user, 'editWeatherRules', { farmHasExpert: false })
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
  const rulesSummary = view.rules.length > 0 ? t('{count} luật', { count: view.rules.length }) : t('Chưa có luật nào')
  const startingRulesCount = getStartingRules(view, mode).length

  return (
    <SettingsSection
      icon={CloudSunIcon}
      title={t('Bù phun sương theo thời tiết')}
      subtitle={view.proposal ? `${rulesSummary} · ${t('có đề xuất chờ duyệt')}` : rulesSummary}
      scopeLabel={t('Nhà')}
      isExpanded={editor.isExpanded(id)}
      onToggle={() => editor.toggle(id)}
      onEdit={canChange ? startEditing : undefined}
      isEditing={isEditing}
      footerNote={
        canChange
          ? joinFooterNotes(
              t('Mức bù từ −10 đến +10 điểm %, chỉ áp cho phun sương'),
              canPropose ? t('Luật mới chỉ chạy khi chuyên gia duyệt') : null,
            )
          : undefined
      }
    >
      {isEditing ? (
        <WeatherRulesEditor
          house={house}
          view={view}
          editor={editor}
          onSaved={onSaved}
          startWithAdd={startWithAdd}
          mode={mode}
        />
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
          {view.proposal && (
            <>
              <Text variant="small" weight="semiBold">
                {t('Đề xuất chờ chuyên gia duyệt · gửi {time}', { time: formatDateTime(view.proposal.proposed_at) })}
              </Text>
              <RuleList rules={view.proposal.rules} />
            </>
          )}
          {canChange ? (
            <Button
              label={t('Thêm luật ({count}/{max})', { count: startingRulesCount, max: MAX_WEATHER_RULES })}
              variant="outline"
              size="md"
              onPress={startAdding}
              disabled={startingRulesCount >= MAX_WEATHER_RULES}
            />
          ) : isViewOnly ? (
            <Text variant="small" color={palette.textSecondary}>
              {t('Bạn chỉ xem mục này')}
            </Text>
          ) : null}
        </>
      )}
    </SettingsSection>
  )
}

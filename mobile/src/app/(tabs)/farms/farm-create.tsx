import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { BarnIcon } from 'phosphor-react-native'
import { LocateRow } from '@/components/farm/settings/LocateRow'
import { SettingsEditActions } from '@/components/farm/settings/SettingsEditActions'
import { SettingsMetaGrid } from '@/components/farm/settings/SettingsMetaGrid'
import { SettingsSection } from '@/components/farm/settings/SettingsSection'
import { AppHeader } from '@/components/layout/AppHeader'
import { TAB_BAR_OVERLAP } from '@/components/layout/BottomTabBar'
import { Spacing } from '@/constants/theme'
import { useCreateFarm } from '@/hooks/farm/useCreateFarm'
import { useLanguage } from '@/hooks/i18n/useLanguage'
import { useReturnBack } from '@/hooks/navigation/useReturnBack'
import { usePalette } from '@/hooks/theme/usePalette'
import type { Coordinates } from '@/types'
import { getSettingsErrorMessage } from '@/utils/apiError.utils'
import {
  COORDINATE_RULES,
  hasDraftErrors,
  NAME_MAX_LENGTH,
  parseNumberDraft,
  toInputText,
  validateName,
  validateNumberDraft,
  type NumberDraft,
} from '@/utils/settingsValidation.utils'
import { t } from '@/utils/i18n.utils'

const COORDINATE_KEYS: (keyof Coordinates)[] = ['lat', 'lng']

/** Tạo trang trại mới (FARM-FR-001, A-5): tên, địa chỉ và toạ độ đều bắt buộc; người tạo là chủ chính.
 * Chưa có gì để chia mục nên là một form đầy đủ, cùng khung ảnh mẫu với trang cài đặt */
export default function FarmCreateScreen() {
  const palette = usePalette()
  // Mở từ Trang chủ thì ‹ về Trang chủ, không thì về danh sách trang trại
  const returnBack = useReturnBack()
  const goBack = returnBack ?? (() => router.back())
  const language = useLanguage()
  const createFarm = useCreateFarm()
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [coordinates, setCoordinates] = useState<NumberDraft<keyof Coordinates>>({ lat: '', lng: '' })
  const coordinateErrors = validateNumberDraft(coordinates, COORDINATE_RULES)
  const nameError = validateName(name)
  const isValid = nameError === null && address.trim() !== '' && !hasDraftErrors(coordinateErrors)

  const submit = () =>
    createFarm.mutate(
      { name: name.trim(), address: address.trim(), coordinates: parseNumberDraft(coordinates, COORDINATE_KEYS) },
      // Về danh sách nhà của farm vừa tạo (Màn A nằm dưới)
      { onSuccess: farm => router.dismissTo({ pathname: '/(tabs)/farms', params: { farmId: farm._id } }) },
    )

  return (
    <View key={language} style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader title={t('Tạo trang trại')} onBack={goBack} />
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { paddingBottom: TAB_BAR_OVERLAP + Spacing.xxl }]}
        >
          <SettingsSection
            icon={BarnIcon}
            title={t('Trang trại mới')}
            subtitle={t('Một trang trại là một địa điểm. Nhà yến ở nơi khác thì tạo trang trại khác')}
            scopeLabel={t('Trang trại')}
            isExpanded          >
            <SettingsMetaGrid
              items={[
                {
                  label: t('Tên trang trại'),
                  input: {
                    value: name,
                    onChangeText: setName,
                    label: t('Tên trang trại'),
                    keyboardType: 'default',
                    autoCapitalize: 'sentences',
                    maxLength: NAME_MAX_LENGTH,
                  },
                  // Ô còn trống thì chưa báo lỗi, chỉ khoá nút Tạo mới
                  error: name === '' ? null : nameError,
                  isFullWidth: true,
                },
                {
                  label: t('Địa chỉ'),
                  input: {
                    value: address,
                    onChangeText: setAddress,
                    label: t('Địa chỉ'),
                    keyboardType: 'default',
                    autoCapitalize: 'sentences',
                  },
                  isFullWidth: true,
                },
                ...COORDINATE_KEYS.map(key => {
                  const label = key === 'lat' ? t('Vĩ độ') : t('Kinh độ')
                  return {
                    label,
                    input: {
                      value: coordinates[key],
                      onChangeText: (text: string) => setCoordinates(current => ({ ...current, [key]: text })),
                      label,
                      keyboardType: 'numbers-and-punctuation' as const,
                    },
                    // Ô còn trống thì chưa báo lỗi, chỉ khoá nút Tạo
                    error: coordinates[key] === '' ? null : (coordinateErrors[key] ?? null),
                  }
                }),
              ]}
            />
            <LocateRow
              onLocated={located => setCoordinates({ lat: toInputText(located.lat), lng: toInputText(located.lng) })}
            />
            {/* Cùng khung với nút "Cập nhật" của trang cài đặt: thanh đen chữ lime căn giữa + Huỷ */}
            <SettingsEditActions
              label={t('Tạo mới')}
              onSave={submit}
              onCancel={goBack}
              isSaving={createFarm.isPending}
              isSaveDisabled={!isValid}
              error={createFarm.error ? getSettingsErrorMessage(createFarm.error) : null}
            />
          </SettingsSection>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.md },
})

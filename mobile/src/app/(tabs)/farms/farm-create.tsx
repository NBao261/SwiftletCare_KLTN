import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BarnIcon } from 'phosphor-react-native'
import { LocateRow } from '@/components/farm/settings/LocateRow'
import { SettingsActionBar } from '@/components/farm/settings/SettingsActionBar'
import { SettingsMetaGrid } from '@/components/farm/settings/SettingsMetaGrid'
import { SettingsSection } from '@/components/farm/settings/SettingsSection'
import { AppHeader } from '@/components/layout/AppHeader'
import { FormMessage } from '@/components/ui/form-message'
import { Spacing } from '@/constants/theme'
import { useCreateFarm } from '@/hooks/farm/useCreateFarm'
import { useLanguage } from '@/hooks/i18n/useLanguage'
import { usePalette } from '@/hooks/theme/usePalette'
import type { Coordinates } from '@/types'
import { getSettingsErrorMessage } from '@/utils/apiError.utils'
import {
  COORDINATE_RULES,
  hasDraftErrors,
  parseNumberDraft,
  toInputText,
  validateNumberDraft,
  type NumberDraft,
} from '@/utils/settingsValidation.utils'
import { t } from '@/utils/i18n.utils'

const COORDINATE_KEYS: (keyof Coordinates)[] = ['lat', 'lng']

/** Tạo trang trại mới (FARM-FR-001, A-5): tên, địa chỉ và toạ độ đều bắt buộc; người tạo là chủ chính.
 * Chưa có gì để chia mục nên là một form đầy đủ, cùng khung ảnh mẫu với trang cài đặt */
export default function FarmCreateScreen() {
  const palette = usePalette()
  const language = useLanguage()
  const insets = useSafeAreaInsets()
  const createFarm = useCreateFarm()
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [coordinates, setCoordinates] = useState<NumberDraft<keyof Coordinates>>({ lat: '', lng: '' })
  const coordinateErrors = validateNumberDraft(coordinates, COORDINATE_RULES)
  const isValid = name.trim() !== '' && address.trim() !== '' && !hasDraftErrors(coordinateErrors)

  const submit = () =>
    createFarm.mutate(
      { name: name.trim(), address: address.trim(), coordinates: parseNumberDraft(coordinates, COORDINATE_KEYS) },
      // Về danh sách nhà của farm vừa tạo (Màn A nằm dưới)
      { onSuccess: farm => router.dismissTo({ pathname: '/(tabs)/farms', params: { farmId: farm._id } }) },
    )

  return (
    <View key={language} style={[styles.screen, { backgroundColor: palette.background }]}>
      <AppHeader title={t('Tạo trang trại')} onBack={() => router.back()} />
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxl }]}
        >
          <SettingsSection
            icon={BarnIcon}
            title={t('Trang trại mới')}
            subtitle={t('Một trang trại là một địa điểm. Nhà yến ở nơi khác thì tạo trang trại khác')}
            scopeLabel={t('Trang trại')}
            isExpanded
            footerNote={t('Bạn là chủ chính của trang trại vừa tạo')}
          >
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
                  },
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
            <FormMessage message={createFarm.error ? getSettingsErrorMessage(createFarm.error) : null} />
            <SettingsActionBar
              label={t('Tạo trang trại')}
              value={t('TẠO')}
              onPress={submit}
              disabled={!isValid}
              loading={createFarm.isPending}
              accessibilityLabel={t('Tạo trang trại')}
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

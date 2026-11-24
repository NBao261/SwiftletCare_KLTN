import { useCallback } from 'react'
import { useTranslation } from '@/hooks/common/useTranslation'
import { isNavigationKey, navigationDict } from '@/constants/navigation.i18n'

// Dịch nhãn menu sidebar theo ngôn ngữ đang chọn, nhãn chưa có trong từ điển giữ nguyên
export function useNavigationLabel() {
  const { t } = useTranslation(navigationDict)
  return useCallback((label: string) => (isNavigationKey(label) ? t(label) : label), [t])
}

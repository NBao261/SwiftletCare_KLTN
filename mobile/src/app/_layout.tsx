import { useCallback, useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/config/queryClient'
import { useAuthStore } from '@/stores/authStore'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { StyleSheet } from 'react-native'
import { useFonts } from 'expo-font'
import { FontFamily } from '@/constants/theme'
import { usePalette } from '@/hooks/theme/usePalette'
import { AnimatedSplash } from '@/components/layout/AnimatedSplash'
import { startRealtimeIfReady } from '@/services/session/localSession'

SplashScreen.preventAutoHideAsync()

// Font Plus Jakarta Sans — tên khoá trùng FontFamily để Typography trỏ đúng file
const FONT_FILES = {
  [FontFamily.regular]: require('@/assets/fonts/PlusJakartaSans-Regular.ttf'),
  [FontFamily.medium]: require('@/assets/fonts/PlusJakartaSans-Medium.ttf'),
  [FontFamily.semiBold]: require('@/assets/fonts/PlusJakartaSans-SemiBold.ttf'),
  [FontFamily.bold]: require('@/assets/fonts/PlusJakartaSans-Bold.ttf'),
}

export default function RootLayout() {
  const loadStoredAuth = useAuthStore(state => state.loadStoredAuth)
  const isLoading = useAuthStore(state => state.isLoading)
  const [fontsLoaded, fontError] = useFonts(FONT_FILES)
  const palette = usePalette()
  // Lỗi nạp font thì vẫn mở app bằng font hệ thống, không kẹt ở splash
  const isReady = !isLoading && (fontsLoaded || fontError !== null)
  const [isSplashDone, setSplashDone] = useState(false)
  const handleSplashFinish = useCallback(() => setSplashDone(true), [])

  useEffect(() => {
    // Mở lại app với phiên đã lưu thì nối lại realtime (cảnh báo, badge) như lúc vừa đăng nhập
    loadStoredAuth().then(startRealtimeIfReady)
  }, [loadStoredAuth])

  // Splash gốc được AnimatedSplash ẩn khi nó vẽ xong; app dựng bên dưới ngay khi nạp xong
  return (
    <GestureHandlerRootView style={styles.root}>
      {/* Bàn phím theo từng khung hình (react-native-keyboard-controller) — khung auth nhích lên cùng nhịp bàn phím */}
      <KeyboardProvider>
        {isReady && (
          <QueryClientProvider client={queryClient}>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
                contentStyle: { backgroundColor: palette.background },
              }}
            >
              {/* Không dùng header gốc của router: mỗi màn tự vẽ AppHeader (components/layout), tự chừa vùng an toàn */}
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="farm/[farmId]" />
              <Stack.Screen name="zone/[zoneId]" />
              <Stack.Screen name="device/[deviceId]" />
              <Stack.Screen name="alert/[alertId]" />
              <Stack.Screen name="livestream/[zoneId]" />
            </Stack>
          </QueryClientProvider>
        )}
        {!isSplashDone && <AnimatedSplash isReady={isReady} onFinish={handleSplashFinish} />}
      </KeyboardProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({ root: { flex: 1 } })

import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/config/queryClient'
import { useAuthStore } from '@/store'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { StyleSheet } from 'react-native'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const loadStoredAuth = useAuthStore(s => s.loadStoredAuth)
  const isLoading = useAuthStore(s => s.isLoading)

  useEffect(() => {
    loadStoredAuth().then(() => SplashScreen.hideAsync())
  }, [])

  if (isLoading) return null

  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="farm/[farmId]" options={{ headerShown: true, title: 'Chi tiết trang trại' }} />
          <Stack.Screen name="zone/[zoneId]" options={{ headerShown: true, title: 'Chi tiết Zone' }} />
          <Stack.Screen name="device/[deviceId]" options={{ headerShown: true, title: 'Chi tiết thiết bị' }} />
          <Stack.Screen name="alert/[alertId]" options={{ headerShown: true, title: 'Chi tiết cảnh báo' }} />
          <Stack.Screen name="livestream/[zoneId]" options={{ headerShown: true, title: 'Livestream Camera' }} />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({ root: { flex: 1 } })

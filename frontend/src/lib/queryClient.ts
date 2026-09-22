import { QueryClient } from '@tanstack/react-query'

/**
 * Singleton QueryClient — tách khỏi main.tsx để các module ngoài React tree
 * (client.ts khi refresh token thất bại, authStore.ts khi đăng xuất) cũng dọn
 * được cache, không chỉ hook trong component mới gọi được useQueryClient().
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

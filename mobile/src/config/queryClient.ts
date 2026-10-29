import { QueryClient } from '@tanstack/react-query'

const FIVE_MINUTES = 5 * 60 * 1000
const TEN_MINUTES = 10 * 60 * 1000

// React Query dùng chung cả app: dữ liệu còn mới 5 phút, giữ cache 10 phút
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: FIVE_MINUTES,
      gcTime: TEN_MINUTES,
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
})

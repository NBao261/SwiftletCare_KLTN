import { QueryClient } from '@tanstack/react-query'

// Tách khỏi main.tsx để code ngoài React tree cũng dọn được cache
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

import type { ReactNode } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'

/**
 * Mọi provider bọc quanh cây React, gom về một chỗ để `main.tsx` chỉ còn việc
 * mount. `queryClient` cố ý nằm ngoài cây (lib/queryClient.ts) để interceptor
 * của axios xoá được cache khi logout / refresh token thất bại.
 */
export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  )
}

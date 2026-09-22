import { cn } from '@/lib/cn'

interface LoadingSkeletonProps {
  className?: string
  count?: number
}

/** LoadingSkeleton – placeholder pulse trong lúc chờ dữ liệu (React Query isLoading) */
export default function LoadingSkeleton({ className, count = 1 }: LoadingSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cn('animate-pulse rounded-2xl bg-warmGray/10', className ?? 'h-24 w-full')} />
      ))}
    </>
  )
}

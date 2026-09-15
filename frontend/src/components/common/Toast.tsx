import { useToastStore } from '@/store/toastStore'
import { cn } from '@/utils/cn'

/** Toast – container hiển thị toàn bộ thông báo, mount 1 lần ở MainLayout */
export default function Toast() {
  const toasts = useToastStore(s => s.toasts)
  const dismiss = useToastStore(s => s.dismiss)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2">
      {toasts.map(t => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={cn(
            'animate-fade-in rounded-2xl px-4 py-3 text-left text-sm font-medium shadow-dock',
            t.tone === 'success' ? 'bg-charcoal text-white' : 'bg-alertRed text-white',
          )}
        >
          {t.message}
        </button>
      ))}
    </div>
  )
}

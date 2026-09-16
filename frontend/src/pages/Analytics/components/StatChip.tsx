import { cn } from '@/utils/cn'

export default function StatChip({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={cn('rounded-2xl border p-4', warn ? 'border-alertRed/30 bg-alertRed/5' : 'border-warmGray/15 bg-white')}>
      <p className="label-caption">{label}</p>
      <p className={cn('mt-1 text-2xl font-extrabold', warn ? 'text-alertRed' : 'text-charcoal')}>{value}</p>
    </div>
  )
}

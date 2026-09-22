import { formatDate } from '@/lib/helpers'
import { cn } from '@/lib/cn'
import type { SettingsMeta } from '@/types'

/** "Cập nhật lần cuối" — dùng chung cho ThresholdsCard/SlaCard, footer canh dưới nhờ card cha `flex flex-col` + khối giữa `flex-1` */
export default function LastUpdatedFooter({ meta, borderClass, textClass }: { meta: SettingsMeta; borderClass: string; textClass: string }) {
  return (
    <p className={cn('mt-3 border-t pt-3 text-xs', borderClass, textClass)}>
      {meta.updated_at
        ? <>Cập nhật lần cuối: {formatDate(meta.updated_at)}{meta.updated_by && <> bởi {meta.updated_by.full_name}</>}</>
        : 'Chưa từng chỉnh — đang dùng giá trị mặc định gốc'}
    </p>
  )
}

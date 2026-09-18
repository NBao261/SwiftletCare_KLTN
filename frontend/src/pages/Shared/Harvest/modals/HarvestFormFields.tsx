import { Input, Select, Textarea } from '@/components/ui'
import { NEST_TYPE_LABEL } from '../constants'
import type { NestType } from '@/types'

export interface HarvestFormValues {
  nest_count: string
  weight_grams: string
  nest_type: NestType
  imagesText: string
}

interface HarvestFormFieldsProps {
  form: HarvestFormValues
  setForm: (updater: (f: HarvestFormValues) => HarvestFormValues) => void
  imagesLabel?: string
}

/** Field dùng chung giữa CreateHarvestModal và EditHarvestModal (số tổ/trọng lượng/loại/ảnh) */
export default function HarvestFormFields({ form, setForm, imagesLabel = 'Ảnh sản phẩm' }: HarvestFormFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Số tổ" type="number" min={1} required
          value={form.nest_count} onChange={e => setForm(f => ({ ...f, nest_count: e.target.value }))}
        />
        <Input
          label="Trọng lượng (gram)" type="number" min={1} step="0.1" required
          value={form.weight_grams} onChange={e => setForm(f => ({ ...f, weight_grams: e.target.value }))}
        />
      </div>
      <Select label="Loại yến" value={form.nest_type} onChange={e => setForm(f => ({ ...f, nest_type: e.target.value as NestType }))}>
        {Object.entries(NEST_TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </Select>
      <Textarea
        label={imagesLabel}
        placeholder={'Dán link ảnh đã host sẵn, mỗi dòng 1 link\nhttps://...'}
        value={form.imagesText} onChange={e => setForm(f => ({ ...f, imagesText: e.target.value }))}
      />
    </>
  )
}

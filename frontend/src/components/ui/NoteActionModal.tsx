import { useState, useEffect, useId, FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { t, tr } from '@/i18n'

interface NoteActionModalProps {
  open: boolean
  onClose: () => void
  title: string
  label: string
  placeholder?: string
  // Dòng ghi chú nhỏ dưới ô nhập: nói hệ quả của hành động
  hint?: string
  submitLabel: string
  required?: boolean
  // Số ký tự tối thiểu (sau khi trim): chặn lý do kiểu "ok"/"abc"
  minLength?: number
  // Số ký tự tối đa: ô không cho gõ quá giới hạn của API
  maxLength?: number
  // Thông báo khi bỏ trống: mặc định "Chưa nhập <label>"
  emptyMessage?: string
  danger?: boolean
  loading: boolean
  onSubmit: (note: string) => void
}

// Modal 1 ô ghi chú; noValidate để báo lỗi tiếng Việt dưới ô
export default function NoteActionModal({
  open, onClose, title, label, placeholder, hint, submitLabel, required, minLength, maxLength, emptyMessage, danger, loading, onSubmit,
}: NoteActionModalProps) {
  // Gắn <label> với ô nhập (a11y; trình đọc màn hình và getByLabel tìm được ô)
  const fieldId = useId()
  const [note, setNote] = useState('')
  const [error, setError] = useState<string>()

  // Modal không unmount giữa các lần mở: xoá nội dung/lỗi cũ mỗi lần mở lại
  useEffect(() => { if (open) { setNote(''); setError(undefined) } }, [open])

  function validate(value: string): string | undefined {
    const trimmed = value.trim()
    if (required && !trimmed) return emptyMessage ? tr(emptyMessage) : t('Chưa nhập {{field}}', { field: tr(label).toLowerCase() })
    if (minLength && trimmed.length < minLength) {
      return t('{{field}} cần ít nhất {{min}} ký tự (đang có {{count}})', { field: tr(label), min: minLength, count: trimmed.length })
    }
    if (maxLength && trimmed.length > maxLength) {
      return t('{{field}} tối đa {{max}} ký tự (đang có {{count}})', { field: tr(label), max: maxLength, count: trimmed.length })
    }
    return undefined
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const message = validate(note)
    if (message) { setError(message); return }
    onSubmit(note.trim())
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Textarea
          id={fieldId}
          label={label}
          placeholder={placeholder /* Textarea tự dịch label/placeholder */}
          required={required}
          maxLength={maxLength}
          value={note}
          error={error}
          // Popup canh giữa: lỗi cùng hàng nhãn để lỗi hiện/ẩn không làm popup trượt lên/xuống
          errorInLabel
          onChange={e => { setNote(e.target.value); if (error) setError(validate(e.target.value)) }}
          onBlur={() => setError(validate(note))}
        />
        {hint && <p className="text-xs text-warmGray">{tr(hint)}</p>}
        <Button type="submit" variant={danger ? 'danger' : 'primary'} loading={loading} className="w-full">
          {tr(submitLabel)}
        </Button>
      </form>
    </Modal>
  )
}

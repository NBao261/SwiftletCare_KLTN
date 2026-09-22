import { useState, useEffect, FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'

interface NoteActionModalProps {
  open: boolean
  onClose: () => void
  title: string
  label: string
  placeholder?: string
  submitLabel: string
  required?: boolean
  /** Số ký tự tối thiểu (sau khi trim) — chặn lý do kiểu "ok"/"abc" */
  minLength?: number
  /** Thông báo khi bỏ trống — mặc định "Chưa nhập <label>" */
  emptyMessage?: string
  danger?: boolean
  loading: boolean
  onSubmit: (note: string) => void
}

/**
 * Modal 1 field (Textarea) + submit — mẫu dùng chung cho các hành động chỉ cần
 * ghi chú (xác nhận cảnh báo, hủy ticket, khoá tài khoản...). Không dùng cho
 * modal nhiều field khác kiểu (mời thành viên, sửa harvest...).
 * Tự validate (noValidate) để báo lỗi tiếng Việt dưới ô thay vì popup trình
 * duyệt; giá trị gửi đi đã được trim.
 */
export default function NoteActionModal({
  open, onClose, title, label, placeholder, submitLabel, required, minLength, emptyMessage, danger, loading, onSubmit,
}: NoteActionModalProps) {
  const [note, setNote] = useState('')
  const [error, setError] = useState<string>()

  // Modal không unmount giữa các lần mở — xoá nội dung/lỗi cũ mỗi lần mở lại
  useEffect(() => { if (open) { setNote(''); setError(undefined) } }, [open])

  function validate(value: string): string | undefined {
    const trimmed = value.trim()
    if (required && !trimmed) return emptyMessage ?? `Chưa nhập ${label.toLowerCase()}`
    if (minLength && trimmed.length < minLength) {
      return `${label} cần ít nhất ${minLength} ký tự (đang có ${trimmed.length})`
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
          label={label}
          placeholder={placeholder}
          required={required}
          value={note}
          error={error}
          onChange={e => { setNote(e.target.value); if (error) setError(validate(e.target.value)) }}
          onBlur={() => setError(validate(note))}
        />
        <Button type="submit" variant={danger ? 'danger' : 'primary'} loading={loading} className="w-full">
          {submitLabel}
        </Button>
      </form>
    </Modal>
  )
}

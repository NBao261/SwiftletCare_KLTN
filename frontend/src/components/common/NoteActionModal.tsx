import { useState, FormEvent } from 'react'
import { Button, Modal, Textarea } from '@/components/ui'

interface NoteActionModalProps {
  open: boolean
  onClose: () => void
  title: string
  label: string
  placeholder?: string
  submitLabel: string
  required?: boolean
  danger?: boolean
  loading: boolean
  onSubmit: (note: string) => void
}

/**
 * Modal 1 field (Textarea) + submit — mẫu dùng chung cho các hành động chỉ cần
 * ghi chú (xác nhận cảnh báo, hủy ticket...). Không dùng cho modal nhiều field
 * khác kiểu (mời thành viên, sửa harvest...).
 */
export default function NoteActionModal({
  open, onClose, title, label, placeholder, submitLabel, required, danger, loading, onSubmit,
}: NoteActionModalProps) {
  const [note, setNote] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSubmit(note)
    setNote('')
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Textarea label={label} placeholder={placeholder} required={required} value={note} onChange={e => setNote(e.target.value)} />
        <Button type="submit" variant={danger ? 'danger' : 'primary'} loading={loading} className="w-full">
          {submitLabel}
        </Button>
      </form>
    </Modal>
  )
}

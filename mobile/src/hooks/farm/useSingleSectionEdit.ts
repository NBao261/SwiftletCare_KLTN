import { useState } from 'react'
import { Alert as NativeAlert } from 'react-native'
import { usePreventRemove } from 'expo-router'
import { t } from '@/utils/i18n.utils'

// Trang cài đặt sửa từng mục: mục bấm vào thì sổ ra để xem, bấm "Sửa" mới nhập được, mỗi lúc chỉ một mục được sửa.
// Đổi mục, đổi zone hay rời trang khi mục đang sửa còn thay đổi chưa lưu thì hỏi trước
export interface InitialSection {
  sectionId: string
  // Mở sẵn chế độ sửa — chỉ truyền true khi người dùng có quyền sửa mục đó
  isEditing: boolean
}

// initial: mục mở sẵn khi vào trang từ nút ⋮ "Chỉnh sửa" của khối Cài đặt zone ở chi tiết nhà
export function useSingleSectionEdit(initial?: InitialSection | null) {
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set(initial ? [initial.sectionId] : []))
  const [editingId, setEditingId] = useState<string | null>(initial?.isEditing ? initial.sectionId : null)
  const [isDirty, setDirty] = useState(false)
  const hasUnsavedChanges = editingId !== null && isDirty

  const stopEditing = () => {
    setEditingId(null)
    setDirty(false)
  }

  // Còn thay đổi chưa lưu thì hỏi; không có thì làm luôn
  const confirmDiscard = (onDiscard: () => void) => {
    if (!hasUnsavedChanges) {
      onDiscard()
      return
    }
    NativeAlert.alert(t('Bỏ thay đổi chưa lưu?'), t('Mục đang sửa có thay đổi chưa được lưu.'), [
      { text: t('Tiếp tục sửa'), style: 'cancel' },
      { text: t('Bỏ thay đổi'), style: 'destructive', onPress: onDiscard },
    ])
  }

  const setExpanded = (id: string, isExpanded: boolean) =>
    setExpandedIds(current => {
      const next = new Set(current)
      if (isExpanded) next.add(id)
      else next.delete(id)
      return next
    })

  // Thu mục đang sửa thì coi như huỷ sửa
  const toggle = (id: string) => {
    if (!expandedIds.has(id)) {
      setExpanded(id, true)
      return
    }
    if (editingId !== id) {
      setExpanded(id, false)
      return
    }
    confirmDiscard(() => {
      stopEditing()
      setExpanded(id, false)
    })
  }

  const startEditing = (id: string) =>
    confirmDiscard(() => {
      setEditingId(id)
      setDirty(false)
      setExpanded(id, true)
    })

  // Huỷ ở chính mục đang sửa: hỏi nếu đã đổi gì
  const cancelEditing = () => confirmDiscard(stopEditing)

  // Rời trang (nút ‹, vuốt, nút Back) khi còn thay đổi chưa lưu
  usePreventRemove(hasUnsavedChanges, ({ repeat }) => {
    NativeAlert.alert(t('Bỏ thay đổi chưa lưu?'), t('Mục đang sửa có thay đổi chưa được lưu.'), [
      { text: t('Tiếp tục sửa'), style: 'cancel' },
      {
        text: t('Bỏ thay đổi'),
        style: 'destructive',
        onPress: () => {
          stopEditing()
          // Chạy lại thao tác rời trang đã bị chặn
          repeat()
        },
      },
    ])
  })

  return {
    isExpanded: (id: string) => expandedIds.has(id),
    isEditing: (id: string) => editingId === id,
    toggle,
    startEditing,
    cancelEditing,
    // Lưu xong: về chế độ xem, không hỏi
    finishEditing: stopEditing,
    // Mục đang sửa báo có thay đổi so với giá trị gốc hay không (gọi trong handler khi gõ)
    setDirty,
    confirmDiscard,
  }
}

// Bộ điều khiển sửa từng mục, truyền xuống các mục của trang cài đặt
export type SectionEditor = ReturnType<typeof useSingleSectionEdit>

// Chữ viết tắt cho ảnh đại diện: chữ đầu của từ đầu và từ cuối ("Nguyễn Vũ Len" → "NL")
export function getInitials(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '_'

  const firstLetter = words.at(0)?.charAt(0) ?? ''
  const lastLetter = words.length > 1 ? (words.at(-1)?.charAt(0) ?? '') : ''
  return (firstLetter + lastLetter).toUpperCase()
}

// Cắt chữ dài hơn số ký tự cho phép và thêm "…" ("Nhà yến Bình Thuận" → "Nhà yến Bì…")
export function truncateText(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text
}

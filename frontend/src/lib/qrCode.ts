// Mã QR của SwiftletCare (Report 4 §5.4, FARM-FR-010/011) — sinh ở client, không có endpoint QR.
// Cùng định dạng với bộ đọc trên mobile (`mobile/src/utils/qrCode.utils.ts`).
import QRCode from 'qrcode'

/** Nhãn thiết bị: device ID + mã kích hoạt, không chứa Wi-Fi hay mật khẩu broker */
export const deviceLabelCode = (deviceId: string, activationKey: string) =>
  `swiftletcare://claim?d=${encodeURIComponent(deviceId)}&k=${encodeURIComponent(activationKey)}`

/** Mã tầng: chỉ zone ID — tự nó không cho quyền gì (FARM-FR-007 vẫn kiểm quyền người quét) */
export const zoneCode = (zoneId: string) => `swiftletcare://zone?z=${encodeURIComponent(zoneId)}`

export const qrDataUrl = (text: string) => QRCode.toDataURL(text, { margin: 1, width: 240 })

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export interface QrLabel {
  code: string
  /** Các dòng chữ cạnh mã; `mono` cho giá trị phải gõ tay được khi camera không đọc mã */
  lines: { text: string; mono?: boolean; strong?: boolean }[]
}

/**
 * In nhãn qua iframe ẩn (không bị chặn popup như window.open sau await). Mỗi nhãn 60 × 32 mm, viền đứt để cắt.
 * ponytail: khổ nhãn cố định; máy in nhãn cuộn khổ khác thì thêm tham số kích thước.
 */
export async function printQrLabels(title: string, labels: QrLabel[]) {
  const images = await Promise.all(labels.map(l => qrDataUrl(l.code)))
  const body = labels.map((l, i) => `
    <div class="label">
      <img src="${images[i]}" alt="">
      <div class="text">${l.lines.map(line =>
        `<div class="${[line.mono && 'mono', line.strong && 'strong'].filter(Boolean).join(' ')}">${escapeHtml(line.text)}</div>`).join('')}
      </div>
    </div>`).join('')

  const frame = document.createElement('iframe')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(frame)
  const doc = frame.contentDocument!
  doc.open()
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    @page { margin: 8mm }
    body { margin: 0; font-family: Arial, sans-serif; color: #000; display: flex; flex-wrap: wrap; gap: 4mm }
    .label { width: 60mm; height: 32mm; box-sizing: border-box; padding: 2mm; border: 1px dashed #888;
             display: flex; align-items: center; gap: 2mm; break-inside: avoid }
    .label img { width: 28mm; height: 28mm; flex-shrink: 0 }
    .text { font-size: 8pt; line-height: 1.35; min-width: 0; overflow-wrap: anywhere }
    .mono { font-family: 'Courier New', monospace; font-size: 9pt; font-weight: bold }
    .strong { font-weight: bold }
  </style></head><body>${body}</body></html>`)
  doc.close()
  const win = frame.contentWindow!
  win.addEventListener('afterprint', () => frame.remove())
  // Ảnh là data URL nên đã sẵn sàng; đợi 1 nhịp cho trình duyệt dựng trang rồi mới mở hộp in
  await new Promise(r => setTimeout(r, 50))
  win.focus()
  win.print()
}

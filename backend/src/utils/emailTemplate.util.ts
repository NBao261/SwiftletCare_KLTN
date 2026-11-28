import { BRAND_DOMAIN, BRAND_URL } from '@/utils/appUrl.util'

// Khung thư SwiftletCare: HTML bảng + CSS nội tuyến (Gmail, Outlook không đọc <style> ngoài), kèm bản chữ thường
// Không ảnh ngoài và không font tải về: Gmail chặn ảnh mặc định, nên logo là chữ

export interface EmailSpec {
  // Dòng xem trước trong hộp thư, trước khi mở thư
  preheader: string
  // Nhãn ngắn trên tiêu đề: thư này là gì ("Lời mời", "Bảo mật tài khoản")
  eyebrow: string
  title: string
  paragraphs: string[]
  // Việc người nhận làm được, mỗi việc một dòng
  list?: { title: string; items: string[] }
  // Mã hay mật khẩu cần chép: hộp chữ đơn cách đều, to
  highlight?: { label: string; value: string }
  details?: Array<{ label: string; value: string }>
  button?: { label: string; url: string }
  // Lưu ý nhỏ cuối thư (bảo mật, hạn dùng)
  notes?: string[]
}

export interface RenderedEmail {
  html: string
  text: string
}

// Màu của giao diện web (tailwind.config): nền thẻ tối charcoal, nhấn xanh chanh
const COLOR = {
  page: '#EAEAEA', card: '#FFFFFF', ink: '#27231F', body: '#4E4A46', muted: '#878380', line: '#E4E1DC', accent: '#B5D32C', panel: '#F6F5F2',
}
const FONT = "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
const MONO = "SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace"

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

const paragraphHtml = (text: string) =>
  `<p style="margin:0 0 14px;font:400 16px/1.65 ${FONT};color:${COLOR.body};">${escapeHtml(text)}</p>`

// Chấm xanh chanh làm dấu đầu dòng; bảng để dòng dài xuống hàng thẳng cột
function listHtml(list: NonNullable<EmailSpec['list']>): string {
  const rows = list.items.map(item => '<tr>'
    + `<td width="24" valign="top" style="padding:7px 0 0;"><span style="display:block;width:8px;height:8px;border-radius:4px;background:${COLOR.accent};"></span></td>`
    + `<td style="padding:0 0 8px;font:400 15px/1.6 ${FONT};color:${COLOR.ink};">${escapeHtml(item)}</td>`
    + '</tr>').join('')
  return `<p style="margin:8px 0 10px;font:700 12px/1.4 ${FONT};letter-spacing:.1em;text-transform:uppercase;color:${COLOR.muted};">${escapeHtml(list.title)}</p>`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">${rows}</table>`
}

function highlightHtml(item: NonNullable<EmailSpec['highlight']>): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 22px;"><tr>`
    + `<td width="4" bgcolor="${COLOR.accent}" style="border-radius:4px 0 0 4px;font-size:0;line-height:0;">&nbsp;</td>`
    + `<td bgcolor="${COLOR.panel}" style="padding:16px 20px;border-radius:0 12px 12px 0;">`
    + `<div style="font:700 12px/1.4 ${FONT};letter-spacing:.1em;text-transform:uppercase;color:${COLOR.muted};">${escapeHtml(item.label)}</div>`
    + `<div style="margin-top:6px;font:700 30px/1.25 ${MONO};letter-spacing:.14em;color:${COLOR.ink};word-break:break-all;">${escapeHtml(item.value)}</div>`
    + '</td></tr></table>'
}

function detailsHtml(rows: NonNullable<EmailSpec['details']>): string {
  const cells = rows.map(row => '<tr>'
    + `<td style="padding:11px 0;border-top:1px solid ${COLOR.line};font:400 13px/20px ${FONT};color:${COLOR.muted};width:38%;vertical-align:top;">${escapeHtml(row.label)}</td>`
    + `<td style="padding:11px 0;border-top:1px solid ${COLOR.line};font:600 14px/20px ${FONT};color:${COLOR.ink};vertical-align:top;">${escapeHtml(row.value)}</td>`
    + '</tr>').join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 20px;border-collapse:collapse;border-bottom:1px solid ${COLOR.line};">${cells}</table>`
}

// Nút làm bằng bảng để Outlook vẫn hiện nền; xanh chanh, chữ charcoal (tương phản cao)
function buttonHtml(button: NonNullable<EmailSpec['button']>): string {
  const url = escapeHtml(button.url)
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:10px 0 12px;"><tr>`
    + `<td align="center" bgcolor="${COLOR.accent}" style="border-radius:999px;">`
    + `<a href="${url}" target="_blank" style="display:inline-block;padding:15px 32px;font:700 16px/1 ${FONT};color:${COLOR.ink};text-decoration:none;border-radius:999px;">${escapeHtml(button.label)}&nbsp;&rarr;</a>`
    + '</td></tr></table>'
    + `<p style="margin:0 0 4px;font:400 12px/1.6 ${FONT};color:${COLOR.muted};">Nút không mở được? Dán liên kết này vào trình duyệt:<br>`
    + `<a href="${url}" target="_blank" style="color:${COLOR.body};word-break:break-all;">${url}</a></p>`
}

const noteHtml = (text: string) =>
  `<p style="margin:0 0 8px;font:400 13px/1.6 ${FONT};color:${COLOR.muted};">${escapeHtml(text)}</p>`

export function renderEmail(spec: EmailSpec): RenderedEmail {
  const content = [
    ...spec.paragraphs.map(paragraphHtml),
    spec.list ? listHtml(spec.list) : '',
    spec.highlight ? highlightHtml(spec.highlight) : '',
    spec.details?.length ? detailsHtml(spec.details) : '',
  ].join('')
  const action = [
    spec.button ? buttonHtml(spec.button) : '',
    spec.notes?.length ? `<div style="margin-top:${spec.button ? 20 : 4}px;">${spec.notes.map(noteHtml).join('')}</div>` : '',
  ].join('')

  const html = '<!doctype html><html lang="vi"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">'
    + `<title>${escapeHtml(spec.title)}</title>`
    // Gmail và Apple Mail đọc <style> trong head: thu lề và cỡ chữ trên điện thoại
    + '<style>@media (max-width:620px){.px{padding-left:22px!important;padding-right:22px!important}.h1{font-size:25px!important}.code{font-size:24px!important}}</style>'
    + '</head>'
    + `<body style="margin:0;padding:0;background:${COLOR.page};">`
    + `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${COLOR.page};">${escapeHtml(spec.preheader)}</div>`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLOR.page};"><tr><td align="center" style="padding:28px 12px;">`
    + `<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${COLOR.card};border-radius:20px;overflow:hidden;">`
    // Dải đầu: nền charcoal, nhãn xanh chanh, tiêu đề trắng to, gạch xanh chanh phía dưới
    + `<tr><td class="px" bgcolor="${COLOR.ink}" style="padding:30px 36px 34px;border-bottom:4px solid ${COLOR.accent};">`
    + `<div style="font:800 13px/1 ${FONT};letter-spacing:.16em;color:#FFFFFF;">SWIFTLET<span style="font-weight:400;color:${COLOR.accent};letter-spacing:.06em;">&nbsp;Care</span></div>`
    + `<div style="margin-top:30px;font:700 12px/1 ${FONT};letter-spacing:.14em;text-transform:uppercase;color:${COLOR.accent};">${escapeHtml(spec.eyebrow)}</div>`
    + `<h1 class="h1" style="margin:10px 0 0;font:700 29px/1.25 ${FONT};color:#FFFFFF;">${escapeHtml(spec.title)}</h1>`
    + '</td></tr>'
    + `<tr><td class="px" style="padding:30px 36px 6px;">${content}</td></tr>`
    + (action ? `<tr><td class="px" style="padding:0 36px 34px;">${action}</td></tr>` : '<tr><td style="padding:0 0 22px;font-size:0;line-height:0;">&nbsp;</td></tr>')
    + '</table>'
    + `<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;"><tr><td align="center" style="padding:20px 8px 0;font:400 12px/1.7 ${FONT};color:${COLOR.muted};">`
    + `<a href="${BRAND_URL}" target="_blank" style="color:${COLOR.ink};font-weight:700;text-decoration:none;">${BRAND_DOMAIN}</a><br>`
    + 'Giám sát và điều khiển nhà yến<br>Thư tự động, đừng trả lời thư này.'
    + '</td></tr></table>'
    + '</td></tr></table></body></html>'

  const lines = [spec.title, '', ...spec.paragraphs.flatMap(paragraph => [paragraph, ''])]
  if (spec.list) lines.push(`${spec.list.title}:`, ...spec.list.items.map(item => `- ${item}`), '')
  if (spec.highlight) lines.push(`${spec.highlight.label}: ${spec.highlight.value}`, '')
  if (spec.details?.length) lines.push(...spec.details.map(row => `${row.label}: ${row.value}`), '')
  if (spec.button) lines.push(`${spec.button.label}: ${spec.button.url}`, '')
  if (spec.notes?.length) lines.push(...spec.notes, '')
  lines.push(`SwiftletCare, ${BRAND_URL}`, 'Giám sát và điều khiển nhà yến')
  return { html, text: lines.join('\n') }
}

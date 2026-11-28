import { escapeHtml, renderEmail } from '@/utils/emailTemplate.util'

const SPEC = {
  preheader: 'Xem trước',
  title: 'Tiêu đề thư',
  paragraphs: ['Đoạn một.', 'Đoạn hai.'],
  highlight: { label: 'Mã', value: '482915' },
  details: [{ label: 'Hạn dùng', value: '23:12 28/11/2026' }],
  button: { label: 'Mở ứng dụng', url: 'https://app.swiftletcare.vn/login' },
  notes: ['Nếu không phải bạn, hãy bỏ qua thư này.'],
}

describe('khung thư SwiftletCare', () => {
  it('thoát ký tự HTML ở mọi chỗ có chữ người dùng nhập, để tên hay mật khẩu không chèn được thẻ', () => {
    expect(escapeHtml(`<a href="x">&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;')
    const { html } = renderEmail({
      ...SPEC,
      title: 'Chào <script>alert(1)</script>',
      paragraphs: ['Trại "A & B"'],
      highlight: { label: 'Mật khẩu', value: '<b>x</b>' },
    })
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<b>x</b>')
    expect(html).toContain('Chào &lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).toContain('Trại &quot;A &amp; B&quot;')
  })

  it('có đủ phần: xem trước, tiêu đề, mã, bảng chi tiết, nút kèm liên kết dán được, lưu ý và chân thư', () => {
    const { html } = renderEmail(SPEC)
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('lang="vi"')
    expect(html).toContain('Xem trước')
    expect(html).toContain('Tiêu đề thư')
    expect(html).toContain('482915')
    expect(html).toContain('Hạn dùng')
    expect(html.match(/href="https:\/\/app\.swiftletcare\.vn\/login"/g)).toHaveLength(2)
    expect(html).toContain('Nếu không phải bạn')
    expect(html).toContain('Thư tự động, đừng trả lời thư này.')
  })

  it('bản chữ thường có cùng nội dung, mỗi giá trị một dòng "Nhãn: giá trị", không còn thẻ HTML', () => {
    const { text } = renderEmail(SPEC)
    expect(text).toContain('Tiêu đề thư')
    expect(text).toContain('Mã: 482915')
    expect(text).toContain('Hạn dùng: 23:12 28/11/2026')
    expect(text).toContain('Mở ứng dụng: https://app.swiftletcare.vn/login')
    expect(text).toContain('Nếu không phải bạn, hãy bỏ qua thư này.')
    expect(text).not.toMatch(/<[a-z/]/)
  })

  it('thư không có mã, nút hay chi tiết thì không vẽ các khung đó', () => {
    const { html, text } = renderEmail({ preheader: 'x', title: 'Chỉ báo tin', paragraphs: ['Nội dung.'] })
    expect(html).not.toContain('bgcolor')
    expect(html).not.toContain('border-collapse')
    expect(text).toBe('Chỉ báo tin\n\nNội dung.\n\nSwiftletCare: giám sát và điều khiển nhà yến')
  })
})

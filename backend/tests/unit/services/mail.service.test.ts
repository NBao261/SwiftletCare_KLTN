import { invitationMail, resetCodeMail, temporaryPasswordMail } from '@/services/mail.service'

const EXPIRES = new Date('2026-12-05T16:00:00Z')

beforeAll(() => { process.env.APP_PUBLIC_URL = 'https://swiftletcare.io.vn/' })
afterAll(() => { delete process.env.APP_PUBLIC_URL })

describe('thư tài khoản', () => {
  it('lời mời: nêu trang trại, vai trò, việc vai đó làm được, hạn và nút nhận lời mời đúng link', () => {
    const mail = invitationMail({ to: 'a@test.vn', farmName: 'Trại yến Demo', role: 'FARM_TECHNICIAN', roleLabel: 'Kỹ thuật viên', token: 'tok123', expiresAt: EXPIRES })
    expect(mail.subject).toBe('Lời mời tham gia Trại yến Demo trên SwiftletCare')
    expect(mail.html).toContain('Bạn được mời tham gia Trại yến Demo')
    expect(mail.html).toContain('Nhận cảnh báo của nhà được giao và xử lý phiếu công việc')
    expect(mail.html).toContain('href="https://swiftletcare.io.vn/invitations/tok123"')
    expect(mail.text).toContain('Nhận lời mời: https://swiftletcare.io.vn/invitations/tok123')
    expect(mail.text).toContain('Hạn lời mời: 23:00 05/12/2026')
  })

  it('mỗi vai được mời có danh sách việc riêng; vai không có danh sách thì thư không vẽ khung đó', () => {
    const base = { to: 'a@test.vn', farmName: 'T', roleLabel: 'x', token: 't', expiresAt: EXPIRES }
    expect(invitationMail({ ...base, role: 'DOMAIN_EXPERT' }).html).toContain('Kiểm chứng cảnh báo suy luận')
    expect(invitationMail({ ...base, role: 'FARM_OWNER' }).html).toContain('Duyệt phiếu công việc')
    expect(invitationMail({ ...base, role: 'ADMIN' }).html).not.toContain('bạn sẽ')
  })

  it('mã đặt lại mật khẩu và mật khẩu tạm nằm trong hộp riêng, bản chữ thường vẫn có "Nhãn: giá trị"', () => {
    const reset = resetCodeMail({ to: 'a@test.vn', code: '482915', expiresAt: EXPIRES })
    expect(reset.html).toContain('482915')
    expect(reset.text).toContain('Mã đặt lại mật khẩu: 482915')
    const temp = temporaryPasswordMail({ to: 'a@test.vn', fullName: 'An', temporaryPassword: 'k7Gp2xQ9mW4z' })
    expect(temp.html).toContain('Đăng nhập SwiftletCare')
    expect(temp.text).toContain('Mật khẩu tạm: k7Gp2xQ9mW4z')
    expect(temp.text).toContain('https://swiftletcare.io.vn/login')
  })
})

// Nội dung chính sách quyền riêng tư, dùng chung cho trang công khai /privacy và trang trong app /settings/privacy.
// Mỗi câu lấy từ Report 3 (mã yêu cầu ghi ở comment); đổi nội dung thì sửa cả 2 bản VI/EN, tăng POLICY_VERSION và ngày hiệu lực.
import { useLanguageStore, type Lang } from '@/stores/languageStore';

const POLICY_VERSION = '1.0';
const EFFECTIVE_DATE = '30/10/2026';

interface PolicySection {
  title: string;
  paragraphs?: string[];
  items?: string[];
}

const SECTIONS_VI: PolicySection[] = [
  {
    // §1.2, C-5
    title: '1. Phạm vi',
    paragraphs: [
      'Mỗi bản cài đặt SwiftletCare phục vụ một chủ nhà yến và các trang trại của chủ đó. Không có đăng ký công khai: Quản trị viên tạo tài khoản Chủ trại và Kỹ thuật viên; người đồng sở hữu và Chuyên gia tham gia qua lời mời.',
      'Dữ liệu cá nhân được xử lý theo Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân.',
    ],
  },
  {
    title: '2. Dữ liệu hệ thống thu thập',
    items: [
      // AUTH-FR-002, NFR-10b
      'Tài khoản: họ tên, e-mail, vai trò và mật khẩu (chỉ lưu dạng băm bcrypt, không lưu mật khẩu gốc).',
      // §3.1, §3.4, §3.11
      'Dữ liệu nhà yến: số đo cảm biến (nhiệt độ, độ ẩm, ánh sáng, NH3, CO2, tiếng ồn), trạng thái relay, lịch sử điều khiển tay, thông tin thiết bị và các đợt thu hoạch.',
      // §3.8, VISION-FR-008, 017
      'Đếm chim: camera ở cửa nhà yến được xử lý trên máy AI để đếm chim ra vào; hệ thống lưu số đếm theo từng 5 phút và theo phiên sáng, chiều của mỗi nhà.',
      // ALERT-FR-013
      'Thông báo: thông báo trong app, và tài khoản Telegram nếu Chủ trại tự liên kết.',
      // AUTH-FR-007, NFR-10c
      'Nhật ký: lần đăng nhập và mọi thay đổi cấu hình (người thực hiện, thời điểm); địa chỉ IP khi đăng nhập dùng để chặn đăng nhập sai liên tục.',
      // FARM-FR-001
      'Vị trí: tọa độ trang trại do Chủ trại nhập.',
    ],
  },
  {
    title: '3. Mục đích sử dụng',
    items: [
      'Điều khiển tự động vi khí hậu, cảnh báo sự cố và dự báo sớm.',
      'Đếm chim và tính tỷ lệ chim về của mỗi nhà.',
      'Bảo vệ tài khoản và truy vết thay đổi qua nhật ký.',
    ],
    paragraphs: [
      // §1.2
      'SwiftletCare không mua bán, không môi giới và không chia sẻ dữ liệu để quảng cáo.',
    ],
  },
  {
    // §2.4
    title: '4. Ai được xem dữ liệu',
    items: [
      'Chủ trại và người đồng sở hữu: toàn bộ dữ liệu trang trại của mình.',
      'Chuyên gia của trang trại: xem dữ liệu vận hành, số đếm chim và báo cáo; không điều khiển relay.',
      'Kỹ thuật viên: nhà, khu, thiết bị và cảnh báo thiết bị; không xem số đo môi trường, số đếm chim, luồng camera, thu hoạch hay báo cáo. Mọi thao tác trên thiết bị đều được ghi nhật ký và báo cho Chủ trại.',
      'Quản trị viên: tài khoản, nhật ký hệ thống và số liệu tổng quan; không xem dữ liệu của trang trại nào.',
    ],
  },
  {
    // ALERT-FR-013
    title: '5. Dịch vụ bên ngoài',
    items: [
      'Telegram: gửi cảnh báo cho Chủ trại đã liên kết tài khoản.',
    ],
  },
  {
    // BR-36
    title: '6. Thời gian lưu trữ',
    items: [
      '90 ngày: số đo cảm biến, số đếm chim theo 5 phút và thông báo trong app.',
      '180 ngày sau khi xử lý: cảnh báo.',
      'Suốt thời gian dùng hệ thống: số đếm theo phiên, thu hoạch, lịch sử điều khiển tay, lịch sử thay đổi và nhật ký hệ thống.',
    ],
  },
  {
    // NFR-10, AUTH-FR-003, VISION-FR-013
    title: '7. Bảo mật',
    items: [
      'Mọi API không công khai đều yêu cầu token; phiên đăng nhập dùng token truy cập 15 phút và token làm mới 30 ngày.',
      'Đăng nhập sai quá 10 lần trong 15 phút từ một địa chỉ IP sẽ bị chặn tạm thời.',
      'Luồng camera chỉ mở được bằng token xem 60 giây, cấp cho Chủ trại hoặc Chuyên gia của trang trại.',
    ],
  },
  {
    // AUTH-FR-009, 012, ALERT-FR-013
    title: '8. Quyền của người dùng',
    items: [
      'Yêu cầu xóa tài khoản và dữ liệu cá nhân: Quản trị viên xử lý trong 30 ngày. Khi xóa, quyền sở hữu trang trại chuyển cho người đồng sở hữu sớm nhất (hoặc trang trại bị xóa mềm nếu không có), dữ liệu cá nhân được ẩn danh.',
      'Đặt lại mật khẩu bằng mã dùng một lần có hiệu lực 15 phút; sau khi đặt lại, mọi phiên cũ bị thu hồi.',
      'Hủy liên kết Telegram bất kỳ lúc nào.',
    ],
  },
  {
    title: '9. Liên hệ và thay đổi chính sách',
    paragraphs: [
      'Mọi câu hỏi hoặc yêu cầu về dữ liệu cá nhân xin gửi Quản trị viên của bản cài đặt.',
      'Khi chính sách thay đổi, phiên bản và ngày hiệu lực ở đầu trang được cập nhật.',
      // ALERT-FR-002, MF-11 — chưa có trong code (gap G-10, G-11)
      'Thông báo push trên app mobile (Firebase Cloud Messaging), thời tiết theo tọa độ trang trại (Open-Meteo) và đánh giá tình trạng mỗi nhà theo ngày sẽ được bổ sung sau; chính sách này được cập nhật trước khi các tính năng đó hoạt động.',
    ],
  },
];

// Bản tiếng Anh, cùng thứ tự mục với SECTIONS_VI
const SECTIONS_EN: PolicySection[] = [
  {
    title: '1. Scope',
    paragraphs: [
      'Each SwiftletCare installation serves one swiftlet house owner and that owner’s farms. There is no public sign-up: the Administrator creates the Farm Owner and Technician accounts; co-owners and the Domain Expert join by invitation.',
      'Personal data is processed according to Decree 13/2023/ND-CP on personal data protection (Vietnam).',
    ],
  },
  {
    title: '2. Data the system collects',
    items: [
      'Account: full name, e-mail, role and password (stored only as a bcrypt hash, never in plain text).',
      'Swiftlet house data: sensor readings (temperature, humidity, light, NH3, CO2, noise), relay states, manual control history, device information and harvests.',
      'Bird counting: the camera at the house entrance is processed on an AI node to count birds going in and out; the system keeps counts per 5 minutes and per morning and afternoon session of each house.',
      'Notifications: in-app notifications, and the Telegram account if the Farm Owner links it.',
      'Logs: sign-ins and every configuration change (who made it, when); the IP address at sign-in is used to block repeated failed sign-ins.',
      'Location: farm coordinates entered by the Farm Owner.',
    ],
  },
  {
    title: '3. How the data is used',
    items: [
      'Automatic microclimate control, incident alerts and early warning.',
      'Counting birds and computing the return rate of each house.',
      'Protecting accounts and tracing changes through the logs.',
    ],
    paragraphs: [
      'SwiftletCare does not sell, broker or share data for advertising.',
    ],
  },
  {
    title: '4. Who can see the data',
    items: [
      'Farm Owner and co-owners: all data of their own farms.',
      'The farm’s Domain Expert: operational data, bird counts and reports; cannot control relays.',
      'Technician: houses, zones, devices and device alerts; cannot see environmental readings, bird counts, the camera stream, harvests or reports. Every device action is logged and reported to the Farm Owner.',
      'Administrator: accounts, system logs and overview figures; cannot see the data of any farm.',
    ],
  },
  {
    title: '5. External services',
    items: [
      'Telegram: sends alerts to a Farm Owner who has linked an account.',
    ],
  },
  {
    title: '6. Retention',
    items: [
      '90 days: sensor readings, 5-minute bird counts and in-app notifications.',
      '180 days after being resolved: alerts.',
      'For as long as the system is used: session counts, harvests, manual control history, change history and system logs.',
    ],
  },
  {
    title: '7. Security',
    items: [
      'Every non-public API requires a token; a session uses a 15-minute access token and a 30-day refresh token.',
      'More than 10 failed sign-ins within 15 minutes from one IP address are blocked for a while.',
      'The camera stream opens only with a 60-second viewing token, issued to the Farm Owner or the farm’s Domain Expert.',
    ],
  },
  {
    title: '8. Your rights',
    items: [
      'Request deletion of your account and personal data: the Administrator handles it within 30 days. On deletion, farm ownership passes to the earliest co-owner (or the farm is soft-deleted if there is none) and personal data is anonymised.',
      'Reset your password with a one-time code valid for 15 minutes; after a reset, every old session is revoked.',
      'Unlink Telegram at any time.',
    ],
  },
  {
    title: '9. Contact and policy changes',
    paragraphs: [
      'Send any question or request about personal data to the Administrator of your installation.',
      'When the policy changes, the version and effective date at the top of the page are updated.',
      'Push notifications in the mobile app (Firebase Cloud Messaging), weather by farm coordinates (Open-Meteo) and the daily status of each house will be added later; this policy is updated before those features go live.',
    ],
  },
];

const POLICY_TEXT: Record<Lang, { heading: string; versionLabel: string; effectiveLabel: string; sections: PolicySection[] }> = {
  vi: { heading: 'Chính sách quyền riêng tư', versionLabel: 'Phiên bản', effectiveLabel: 'Hiệu lực từ', sections: SECTIONS_VI },
  en: { heading: 'Privacy policy', versionLabel: 'Version', effectiveLabel: 'Effective from', sections: SECTIONS_EN },
};

export default function PrivacyPolicy(): JSX.Element {
  const lang = useLanguageStore(state => state.lang);
  const text = POLICY_TEXT[lang];
  return (
    <>
      <h1 className="text-h1 text-charcoal">{text.heading}</h1>
      <p className="mt-1 text-small text-warmGray">
        {text.versionLabel} {POLICY_VERSION} · {text.effectiveLabel} {EFFECTIVE_DATE}
      </p>

      {text.sections.map(section => (
        <section key={section.title} className="mt-6">
          <h2 className="text-h3 text-charcoal">{section.title}</h2>
          {section.items && (
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-body text-charcoal">
              {section.items.map(item => <li key={item}>{item}</li>)}
            </ul>
          )}
          {section.paragraphs?.map(paragraph => (
            <p key={paragraph} className="mt-2 text-body text-charcoal">{paragraph}</p>
          ))}
        </section>
      ))}
    </>
  );
}

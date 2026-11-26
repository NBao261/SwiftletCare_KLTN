// Đổi nội dung thì sửa cả bản VI/EN, tăng POLICY_VERSION và ngày hiệu lực
import { useLanguageStore, type Lang } from '@/stores/languageStore';

const POLICY_VERSION = '1.1';
const EFFECTIVE_DATE = '21/11/2026';

interface PolicySection {
  title: string;
  paragraphs?: string[];
  items?: string[];
}

const SECTIONS_VI: PolicySection[] = [
  {
    title: '1. Phạm vi',
    paragraphs: [
      'Mỗi bản cài đặt SwiftletCare phục vụ một chủ nhà yến và các trang trại của chủ đó. Không có đăng ký công khai: Quản trị viên tạo tài khoản chủ nhà yến và Kỹ thuật viên; người đồng sở hữu và Chuyên gia tham gia qua lời mời.',
      'Dữ liệu cá nhân được xử lý theo Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân.',
    ],
  },
  {
    title: '2. Dữ liệu hệ thống thu thập',
    items: [
      'Tài khoản: họ tên, e-mail, vai trò và mật khẩu (chỉ lưu dạng băm bcrypt, không lưu mật khẩu gốc).',
      'Dữ liệu nhà yến: số đo cảm biến (nhiệt độ, độ ẩm, ánh sáng, NH3, CO2, tiếng ồn), trạng thái rơ-le, lịch sử điều khiển tay, thông tin thiết bị và các đợt thu hoạch.',
      'Đếm chim: hình camera ở cửa nhà yến được xử lý trên máy đếm chim; hệ thống lưu số chim ra vào theo từng 5 phút và theo phiên sáng, chiều của mỗi nhà.',
      'Thông báo: thông báo trong ứng dụng và Telegram, nếu chủ nhà yến tự liên kết.',
      'Nhật ký: lần đăng nhập và mọi thay đổi cấu hình (người thực hiện, thời điểm); địa chỉ IP khi đăng nhập dùng để chặn đăng nhập sai liên tục.',
      'Vị trí: toạ độ trang trại do chủ nhà yến nhập.',
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
      'SwiftletCare không mua bán, không môi giới và không chia sẻ dữ liệu để quảng cáo.',
    ],
  },
  {
    title: '4. Ai được xem dữ liệu',
    items: [
      'Chủ nhà yến và người đồng sở hữu: toàn bộ dữ liệu trang trại của mình.',
      'Chuyên gia của trang trại: xem dữ liệu vận hành, số đếm chim và báo cáo; không điều khiển rơ-le.',
      'Kỹ thuật viên: nhà, Zone, thiết bị và cảnh báo thiết bị; không xem số đo môi trường, số đếm chim, luồng camera, thu hoạch hay báo cáo. Mọi thao tác trên thiết bị đều được ghi nhật ký và báo cho Chủ nhà yến.',
      'Quản trị viên: tài khoản, nhật ký hệ thống và số liệu tổng quan; không xem dữ liệu của trang trại nào.',
    ],
  },
  {
    title: '5. Dịch vụ bên ngoài',
    items: [
      'Telegram: gửi cảnh báo cho chủ nhà yến đã liên kết tài khoản.',
      'Open-Meteo: thời tiết theo giờ và dự báo; hệ thống chỉ gửi vĩ độ, kinh độ của trang trại.',
      'OpenStreetMap: bản đồ để chọn vị trí trang trại. Trình duyệt tải ô bản đồ của vùng đang xem; khi gõ địa chỉ trang trại, phần đã gõ được gửi tới dịch vụ gợi ý địa chỉ Photon (komoot) để hiện gợi ý.',
    ],
  },
  {
    title: '6. Thời gian lưu trữ',
    items: [
      '90 ngày: số đo cảm biến, số đếm chim theo 5 phút và thông báo trong ứng dụng.',
      '180 ngày sau khi xử lý: cảnh báo.',
      'Suốt thời gian dùng hệ thống: số đếm theo phiên, thu hoạch, lịch sử điều khiển tay, lịch sử thay đổi và nhật ký hệ thống.',
    ],
  },
  {
    title: '7. Bảo mật',
    items: [
      'Ngoài đăng nhập và lời mời, mọi thao tác đều cần đăng nhập. Phiên đăng nhập tự gia hạn trong 30 ngày.',
      'Đăng nhập sai quá 10 lần trong 15 phút từ một địa chỉ IP sẽ bị chặn tạm thời.',
      'Luồng camera chỉ mở được bằng mã xem có hạn 60 giây, cấp cho chủ nhà yến hoặc chuyên gia của trang trại.',
    ],
  },
  {
    title: '8. Quyền của người dùng',
    items: [
      'Yêu cầu xoá tài khoản và dữ liệu cá nhân: Quản trị viên xử lý trong 30 ngày. Khi xoá, quyền sở hữu trang trại chuyển cho người đồng sở hữu sớm nhất (hoặc trang trại bị xoá mềm nếu không có), dữ liệu cá nhân được ẩn danh.',
      'Đặt lại mật khẩu bằng mã dùng một lần có hiệu lực 15 phút; sau khi đặt lại, mọi phiên cũ bị thu hồi.',
      'Huỷ liên kết Telegram bất kỳ lúc nào.',
    ],
  },
  {
    title: '9. Liên hệ và thay đổi chính sách',
    paragraphs: [
      'Mọi câu hỏi hoặc yêu cầu về dữ liệu cá nhân xin gửi Quản trị viên của bản cài đặt.',
      'Khi chính sách thay đổi, phiên bản và ngày hiệu lực ở đầu trang được cập nhật.',
      // chưa gửi thật (gap)
      'Thông báo đẩy trên ứng dụng điện thoại (Firebase Cloud Messaging) sẽ được bổ sung sau; chính sách này được cập nhật trước khi tính năng đó hoạt động.',
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
      'Open-Meteo: hourly weather and forecast; the system sends only the latitude and longitude of the farm.',
      'OpenStreetMap: the map for choosing the farm location. The browser loads the map tiles of the area in view; while the farm address is typed, the typed text is sent to the Photon address service (komoot) to show suggestions.',
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
      'Push notifications in the mobile app (Firebase Cloud Messaging) will be added later; this policy is updated before that feature goes live.',
    ],
  },
];

const POLICY_TEXT: Record<Lang, { heading: string; versionLabel: string; effectiveLabel: string; contents: string; sections: PolicySection[] }> = {
  vi: { heading: 'Chính sách quyền riêng tư', versionLabel: 'Phiên bản', effectiveLabel: 'Hiệu lực từ', contents: 'Mục lục', sections: SECTIONS_VI },
  en: { heading: 'Privacy policy', versionLabel: 'Version', effectiveLabel: 'Effective from', contents: 'Contents', sections: SECTIONS_EN },
};

// Mục lục cuộn mượt tới từng mục (khung cuộn của ứng dụng không phải cửa sổ nên không dùng link #)
function scrollToSection(index: number): void {
  document.getElementById(`policy-section-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// headingLevel: trang công khai không có header nên tiêu đề là h1; trong khung app tên trang đã là h1
export default function PrivacyPolicy({ headingLevel: Heading = 'h1' }: { headingLevel?: 'h1' | 'h2' }): JSX.Element {
  const lang = useLanguageStore(state => state.lang);
  const text = POLICY_TEXT[lang];
  return (
    <>
      <Heading className="text-h1 text-charcoal">{text.heading}</Heading>
      <p className="mt-1 text-small text-warmGray">
        {text.versionLabel} {POLICY_VERSION} · {text.effectiveLabel} {EFFECTIVE_DATE}
      </p>

      {/* Mục lục: chính sách dài 9 mục nên cho nhảy thẳng tới mục cần đọc */}
      <nav aria-label={text.contents} className="mt-4 flex flex-wrap gap-2">
        {text.sections.map((section, index) => (
          <button
            key={section.title}
            type="button"
            onClick={() => scrollToSection(index)}
            className="rounded-full border border-warmGray/20 px-3 py-1 text-small font-medium text-graphite transition-colors hover:border-warmGray/40 hover:text-charcoal"
          >
            {section.title}
          </button>
        ))}
      </nav>

      {text.sections.map((section, index) => (
        <section key={section.title} id={`policy-section-${index}`} className="mt-6 scroll-mt-24">
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

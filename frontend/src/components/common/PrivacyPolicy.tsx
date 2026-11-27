// Đổi nội dung thì sửa cả bản VI/EN, tăng POLICY_VERSION và ngày hiệu lực
import { useLanguageStore, type Lang } from '@/stores/languageStore';

const POLICY_VERSION = '1.2';
const EFFECTIVE_DATE = '27/11/2026';

interface PolicySection {
  title: string;
  paragraphs?: string[];
  items?: string[];
}

const SECTIONS_VI: PolicySection[] = [
  {
    title: '1. Phạm vi và ai chịu trách nhiệm',
    paragraphs: [
      'Mỗi bản cài đặt SwiftletCare phục vụ một chủ nhà yến và các trang trại của chủ đó. Không có đăng ký công khai: Quản trị viên tạo tài khoản chủ nhà yến; Kỹ thuật viên, người đồng sở hữu và Chuyên gia tham gia qua lời mời của chủ nhà yến.',
      'Chủ nhà yến quyết định ai được mời và dữ liệu nào được nhập cho trang trại của mình. Quản trị viên của bản cài đặt vận hành hệ thống và là đầu mối nhận mọi yêu cầu về dữ liệu cá nhân (mục 10).',
      'Dữ liệu cá nhân được xử lý theo Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân.',
    ],
  },
  {
    title: '2. Dữ liệu được thu thập',
    items: [
      'Tài khoản: họ tên, e-mail, số điện thoại (nếu có), vai trò, các trang trại và nhà bạn được giao. Mật khẩu chỉ lưu dạng băm bcrypt, không lưu mật khẩu gốc.',
      'Dữ liệu nhà yến: số đo cảm biến (nhiệt độ, độ ẩm, ánh sáng, NH3, CO2, tiếng ồn), trạng thái rơ-le, thông tin và tình trạng thiết bị, cảnh báo và lịch sử thay đổi cấu hình.',
      'Công việc và đánh giá: phiếu công việc, kết quả kiểm tra và bảo trì, đánh giá sức khoẻ hằng ngày, các đợt thu hoạch và ảnh bạn đính kèm. Ảnh được lưu riêng và chỉ mở bằng liên kết tạm có hiệu lực 1 giờ.',
      'Đếm chim: hình camera ở cửa nhà yến được xử lý trên máy đếm chim để đếm chim ra vào. Hệ thống chỉ lưu số đếm theo từng 5 phút và theo phiên sáng, chiều, không ghi lại video. Camera có thể quay cả người đi qua gần cửa; hệ thống không nhận dạng người. Địa chỉ camera và mật khẩu camera do chủ nhà yến nhập được mã hoá khi lưu và không hiện lại.',
      'Thông báo: thông báo trong ứng dụng; mã trò chuyện Telegram nếu bạn tự liên kết; mã nhận thông báo đẩy của điện thoại nếu bạn dùng ứng dụng di động và cho phép.',
      'Nhật ký: lần đăng nhập và mọi thay đổi quan trọng (người thực hiện, thời điểm, địa chỉ IP và loại thiết bị hoặc trình duyệt). Địa chỉ IP khi đăng nhập còn dùng để chặn đăng nhập sai liên tục.',
      'Vị trí: toạ độ trang trại do chủ nhà yến nhập, hoặc điền bằng nút lấy vị trí hiện tại khi tạo trang trại. Hệ thống không theo dõi vị trí của bạn.',
      'Trình duyệt: cookie đăng nhập (httpOnly) và bộ nhớ của trình duyệt dùng để nhớ phiên đăng nhập, ngôn ngữ và lựa chọn giao diện. Không có cookie quảng cáo hay theo dõi.',
    ],
  },
  {
    title: '3. Mục đích và cơ sở xử lý',
    items: [
      'Điều khiển tự động vi khí hậu, cảnh báo sự cố và dự báo sớm.',
      'Đếm chim và tính tỷ lệ chim về của mỗi nhà; đánh giá sức khoẻ hằng ngày và lập báo cáo.',
      'Giao việc, nhắc việc, theo dõi bảo trì và thu hoạch (mục 9 nói rõ phần theo dõi công việc).',
      'Bảo vệ tài khoản và truy vết thay đổi qua nhật ký.',
    ],
    paragraphs: [
      'Dữ liệu được xử lý để thực hiện việc quản lý nhà yến mà chủ nhà yến giao cho hệ thống, và khi bạn đồng ý (ví dụ liên kết Telegram, cho phép thông báo đẩy).',
      'SwiftletCare không mua bán, không môi giới và không chia sẻ dữ liệu để quảng cáo.',
    ],
  },
  {
    title: '4. Ai được xem dữ liệu',
    items: [
      'Chủ nhà yến và người đồng sở hữu: toàn bộ dữ liệu của trang trại mình, gồm các thao tác của Kỹ thuật viên (mục 9).',
      'Chuyên gia của trang trại: xem số đo, số đếm chim, cảnh báo, báo cáo và thu hoạch của cả trang trại; chỉnh tham số, viết kết luận và kiểm chứng cảnh báo; không điều khiển rơ-le và không ghi thu hoạch.',
      'Kỹ thuật viên: chỉ các nhà được giao. Xem số đo, số đếm chim, hình camera, cảnh báo, báo cáo và phiếu công việc của nhà đó; đánh giá ngày, nhập thu hoạch của mình; không xem so sánh giữa các nhà và không thấy địa chỉ camera.',
      'Quản trị viên: tài khoản (họ tên, e-mail, vai trò, trạng thái), nhật ký hệ thống, thiết bị cùng cảnh báo thiết bị của mọi trang trại và số liệu tổng quan của hệ thống; không xem số đo môi trường, số đếm chim, hình camera, thu hoạch hay báo cáo của trang trại nào.',
    ],
  },
  {
    title: '5. Dịch vụ bên ngoài và nơi lưu trữ',
    items: [
      'Telegram: gửi cảnh báo cho người đã tự liên kết tài khoản; Telegram nhận nội dung cảnh báo và mã trò chuyện của bạn.',
      'Firebase Cloud Messaging (Google): gửi thông báo đẩy tới ứng dụng điện thoại khi bạn cho phép.',
      'Dịch vụ thư điện tử: gửi mã đặt lại mật khẩu và lời mời tới địa chỉ e-mail của bạn.',
      'Open-Meteo: thời tiết theo giờ và dự báo; hệ thống chỉ gửi vĩ độ, kinh độ của trang trại.',
      'OpenStreetMap: bản đồ để chọn vị trí trang trại. Trình duyệt tải ô bản đồ của vùng đang xem; khi gõ địa chỉ trang trại, phần đã gõ được gửi tới dịch vụ gợi ý địa chỉ Photon (komoot) để hiện gợi ý.',
      'Nơi lưu trữ: dữ liệu và ảnh được lưu trên máy chủ và kho tệp đám mây của bản cài đặt, có thể đặt ngoài lãnh thổ Việt Nam.',
    ],
    paragraphs: [
      'Ngoài các dịch vụ trên, dữ liệu không được chuyển cho bên thứ ba nào khác.',
    ],
  },
  {
    title: '6. Thời gian lưu trữ',
    items: [
      '90 ngày: số đo cảm biến, số đếm chim theo 5 phút, thời tiết theo giờ và thông báo trong ứng dụng.',
      '180 ngày sau khi xử lý xong: cảnh báo.',
      'Suốt thời gian dùng hệ thống: số đếm theo phiên, đánh giá sức khoẻ hằng ngày và báo cáo, phiếu công việc kèm ảnh, kế hoạch và hồ sơ bảo trì, khuyến nghị, thu hoạch, lịch sử điều khiển tay, lịch sử thay đổi và nhật ký hệ thống.',
      'Khi tài khoản được xoá, dữ liệu cá nhân bị ẩn danh. Bản sao lưu định kỳ của máy chủ có thể còn dữ liệu cũ cho tới khi bản sao lưu đó bị thay thế.',
    ],
  },
  {
    title: '7. Bảo mật',
    items: [
      'Ngoài đăng nhập và lời mời, mọi thao tác đều cần đăng nhập. Phiên đăng nhập dùng mã truy cập 15 phút và mã làm mới 30 ngày; đặt lại mật khẩu thì mọi phiên cũ bị thu hồi.',
      'Đăng nhập sai quá 10 lần trong 15 phút từ một địa chỉ IP sẽ bị chặn tạm thời.',
      'Quyền xem và sửa theo vai trò và theo nhà được giao; mọi thao tác quan trọng được ghi nhật ký.',
      'Mỗi thiết bị chỉ gửi và nhận trên kênh riêng của nó, thiết bị bị thu hồi thì không kết nối lại được.',
      'Hình camera chỉ mở bằng mã xem có hạn 60 giây, cấp cho người có quyền xem camera của nhà đó.',
    ],
  },
  {
    title: '8. Quyền của bạn và cách thực hiện',
    items: [
      'Được biết dữ liệu nào được xử lý và vì sao: chính sách này và hồ sơ của bạn ở Cài đặt.',
      'Xem và đề nghị chỉnh sửa họ tên, e-mail, số điện thoại: gửi Quản trị viên (hồ sơ trong ứng dụng hiện chỉ để xem).',
      'Rút lại sự đồng ý bất kỳ lúc nào: huỷ liên kết Telegram, tắt thông báo đẩy hoặc đổi kênh nhận cảnh báo ở Cài đặt.',
      'Yêu cầu xoá tài khoản và dữ liệu cá nhân: gửi ngay ở Cài đặt, mục Dữ liệu tài khoản; Quản trị viên xử lý trong 30 ngày. Khi xoá, quyền sở hữu trang trại chuyển cho người đồng sở hữu sớm nhất (hoặc trang trại bị xoá mềm nếu không có), dữ liệu cá nhân được ẩn danh. Bạn huỷ được yêu cầu trước khi Quản trị viên xử lý.',
      'Yêu cầu hạn chế xử lý, phản đối việc xử lý hoặc xin bản sao dữ liệu cá nhân: gửi Quản trị viên, yêu cầu được xem xét và trả lời theo quy định pháp luật.',
      'Khiếu nại: nếu không đồng ý với cách xử lý, bạn có quyền khiếu nại tới Quản trị viên hoặc cơ quan nhà nước có thẩm quyền.',
      'Đặt lại mật khẩu bằng mã dùng một lần có hiệu lực 15 phút.',
    ],
  },
  {
    title: '9. Theo dõi công việc của Kỹ thuật viên',
    items: [
      'Mọi thao tác của Kỹ thuật viên trên thiết bị (bật tắt tay, khởi động lại, thiết lập, dời, gỡ), xác nhận cảnh báo, ghi nguyên nhân, đánh giá ngày và nhập thu hoạch đều ghi lại tên người làm và thời điểm. Chủ nhà yến xem được ở lịch sử điều khiển tay, phiếu công việc, cảnh báo và thông báo trong ứng dụng; nhật ký hệ thống đầy đủ do Quản trị viên xem.',
      'Hệ thống tính thời gian từ lúc có cảnh báo đến lúc xác nhận và xử lý xong, và tỷ lệ bảo trì đúng hạn, theo từng nhà và từng Kỹ thuật viên. Đây là mục tiêu nội bộ của trang trại để chủ nhà yến theo dõi công việc.',
      'Lịch trực do chủ nhà yến đặt được lưu và dùng để chọn người nhận cảnh báo đầu tiên.',
      'Hệ thống không theo dõi vị trí hay thời gian làm việc ngoài các thao tác kể trên.',
    ],
  },
  {
    title: '10. Sự cố dữ liệu, liên hệ và thay đổi chính sách',
    paragraphs: [
      'Khi xảy ra sự cố làm lộ hoặc mất dữ liệu cá nhân, Quản trị viên thông báo cho người bị ảnh hưởng và cơ quan có thẩm quyền theo quy định pháp luật.',
      'Mọi câu hỏi hoặc yêu cầu về dữ liệu cá nhân xin gửi Quản trị viên của bản cài đặt; nếu bạn chưa biết liên hệ ai, hỏi chủ nhà yến đã mời bạn.',
      'Khi chính sách thay đổi, phiên bản và ngày hiệu lực ở đầu trang được cập nhật.',
    ],
  },
];

// Bản tiếng Anh, cùng thứ tự mục với SECTIONS_VI
const SECTIONS_EN: PolicySection[] = [
  {
    title: '1. Scope and who is responsible',
    paragraphs: [
      'Each SwiftletCare installation serves one swiftlet house owner and that owner’s farms. There is no public sign-up: the Administrator creates the Farm Owner’s account; Farm Technicians, co-owners and the Domain Expert join by the Farm Owner’s invitation.',
      'The Farm Owner decides who is invited and what data is entered for their farms. The Administrator of the installation runs the system and is the contact for every request about personal data (section 10).',
      'Personal data is processed according to Decree 13/2023/ND-CP on personal data protection (Vietnam).',
    ],
  },
  {
    title: '2. Data collected',
    items: [
      'Account: full name, e-mail, phone number (if given), role, and the farms and houses you are assigned to. The password is stored only as a bcrypt hash, never in plain text.',
      'Swiftlet house data: sensor readings (temperature, humidity, light, NH3, CO2, noise), relay states, device information and status, alerts and the history of configuration changes.',
      'Work and ratings: Work Orders, inspection and maintenance results, daily health ratings, harvests and the photos you attach. Photos are stored separately and opened only through a temporary link valid for 1 hour.',
      'Bird counting: the camera at the house entrance is processed on an AI node to count birds going in and out. The system keeps only the counts per 5 minutes and per morning and afternoon session, and does not record video. The camera may film people passing the entrance; the system does not identify people. The camera address and password entered by the Farm Owner are encrypted when stored and never shown again.',
      'Notifications: in-app notifications; the Telegram chat ID if you link it yourself; the phone’s push token if you use the mobile app and allow it.',
      'Logs: sign-ins and every important change (who made it, when, the IP address and the type of device or browser). The IP address at sign-in is also used to block repeated failed sign-ins.',
      'Location: farm coordinates entered by the Farm Owner, or filled with the current-location button when a farm is created. The system does not track your location.',
      'Browser: the sign-in cookie (httpOnly) and the browser’s storage used to remember your session, language and interface choices. There are no advertising or tracking cookies.',
    ],
  },
  {
    title: '3. Purposes and basis of processing',
    items: [
      'Automatic microclimate control, incident alerts and early warning.',
      'Counting birds and computing the return rate of each house; daily health ratings and reports.',
      'Assigning and reminding work, following maintenance and harvests (section 9 describes the follow-up of work).',
      'Protecting accounts and tracing changes through the logs.',
    ],
    paragraphs: [
      'Data is processed to carry out the swiftlet house management that the Farm Owner entrusts to the system, and with your consent (for example linking Telegram or allowing push notifications).',
      'SwiftletCare does not sell, broker or share data for advertising.',
    ],
  },
  {
    title: '4. Who can see the data',
    items: [
      'Farm Owner and co-owners: all data of their own farms, including the actions of Farm Technicians (section 9).',
      'The farm’s Domain Expert: readings, bird counts, alerts, reports and harvests of the whole farm; edits parameters, writes conclusions and validates alerts; cannot control relays or enter harvests.',
      'Farm Technician: only the assigned houses. Sees readings, bird counts, the camera view, alerts, reports and Work Orders of those houses; rates days and enters their own harvests; cannot see the comparison between houses or the camera address.',
      'Administrator: accounts (name, e-mail, role, status), system logs, the devices and device alerts of every farm and the system overview figures; cannot see the environmental readings, bird counts, camera view, harvests or reports of any farm.',
    ],
  },
  {
    title: '5. External services and where data is kept',
    items: [
      'Telegram: sends alerts to a person who has linked an account; Telegram receives the alert text and your chat ID.',
      'Firebase Cloud Messaging (Google): sends push notifications to the mobile app when you allow it.',
      'E-mail service: sends password reset codes and invitations to your e-mail address.',
      'Open-Meteo: hourly weather and forecast; the system sends only the latitude and longitude of the farm.',
      'OpenStreetMap: the map for choosing the farm location. The browser loads the map tiles of the area in view; while the farm address is typed, the typed text is sent to the Photon address service (komoot) to show suggestions.',
      'Storage: data and photos are kept on the installation’s server and cloud file storage, which may be located outside Vietnam.',
    ],
    paragraphs: [
      'Apart from the services above, data is not passed to any other third party.',
    ],
  },
  {
    title: '6. Retention',
    items: [
      '90 days: sensor readings, 5-minute bird counts, hourly weather and in-app notifications.',
      '180 days after being resolved: alerts.',
      'For as long as the system is used: session counts, daily health ratings and reports, Work Orders with their photos, maintenance plans and records, recommendations, harvests, manual control history, change history and system logs.',
      'When an account is deleted, its personal data is anonymised. The server’s periodic backups may still hold older data until that backup is replaced.',
    ],
  },
  {
    title: '7. Security',
    items: [
      'Apart from sign-in and invitations, every action requires a sign-in. A session uses a 15-minute access token and a 30-day refresh token; resetting the password revokes every old session.',
      'More than 10 failed sign-ins within 15 minutes from one IP address are blocked for a while.',
      'Viewing and editing rights follow the role and the assigned houses; every important action is logged.',
      'Each device sends and receives only on its own channel, and a revoked device cannot connect again.',
      'The camera view opens only with a 60-second viewing token, issued to a person who may view the camera of that house.',
    ],
  },
  {
    title: '8. Your rights and how to use them',
    items: [
      'To know what data is processed and why: this policy and your profile in Settings.',
      'To see and ask for correction of your name, e-mail and phone number: send the Administrator a request (the profile in the app is read-only for now).',
      'To withdraw consent at any time: unlink Telegram, turn off push notifications or change the alert channels in Settings.',
      'To request deletion of your account and personal data: send it in Settings, under Account data; the Administrator handles it within 30 days. On deletion, farm ownership passes to the earliest co-owner (or the farm is soft-deleted if there is none) and personal data is anonymised. You can cancel the request before the Administrator handles it.',
      'To ask to restrict processing, object to it or get a copy of your personal data: send the Administrator a request, which is reviewed and answered as the law requires.',
      'To complain: if you disagree with how data is handled, you may complain to the Administrator or to the competent state authority.',
      'To reset your password with a one-time code valid for 15 minutes.',
    ],
  },
  {
    title: '9. Follow-up of Farm Technicians’ work',
    items: [
      'Every action of a Farm Technician on a device (manual switching, restart, setup, move, removal), acknowledging an alert, recording a cause, rating a day and entering a harvest is logged with the person’s name and the time. The Farm Owner sees them in the manual control history, Work Orders, alerts and in-app notifications; the full system log is read by the Administrator.',
      'The system computes the time from an alert to its acknowledgement and resolution, and the on-time maintenance rate, per house and per Farm Technician. These are internal targets of the farm that help the Farm Owner follow the work.',
      'The duty roster set by the Farm Owner is stored and used to choose who receives an alert first.',
      'The system does not track location or working hours beyond the actions listed above.',
    ],
  },
  {
    title: '10. Data incidents, contact and policy changes',
    paragraphs: [
      'If an incident exposes or loses personal data, the Administrator informs the people affected and the competent authority as the law requires.',
      'Send any question or request about personal data to the Administrator of your installation; if you do not know whom to contact, ask the Farm Owner who invited you.',
      'When the policy changes, the version and effective date at the top of the page are updated.',
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

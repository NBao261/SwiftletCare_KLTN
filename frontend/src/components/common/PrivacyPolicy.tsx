// Nội dung chính sách quyền riêng tư, dùng chung cho trang công khai /privacy và trang trong app /settings/privacy.
// Mỗi câu lấy từ Report 3 (mã yêu cầu ghi ở comment); đổi nội dung thì tăng POLICY_VERSION và ngày hiệu lực.
const POLICY_VERSION = '1.0';
const EFFECTIVE_DATE = '30/10/2026';

interface PolicySection {
  title: string;
  paragraphs?: string[];
  items?: string[];
}

const SECTIONS: PolicySection[] = [
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
      // ALERT-FR-002, 013
      'Thông báo: mã thiết bị nhận push (Firebase Cloud Messaging) của app mobile đang đăng nhập, và tài khoản Telegram nếu Chủ trại tự liên kết.',
      // AUTH-FR-007, NFR-10c
      'Nhật ký: lần đăng nhập và mọi thay đổi cấu hình (người thực hiện, thời điểm); địa chỉ IP khi đăng nhập dùng để chặn đăng nhập sai liên tục.',
      // ANALYTICS-FR-013
      'Vị trí: tọa độ trang trại, dùng để lấy thời tiết.',
    ],
  },
  {
    title: '3. Mục đích sử dụng',
    items: [
      'Điều khiển tự động vi khí hậu, cảnh báo sự cố và dự báo sớm.',
      'Đếm chim, tính tỷ lệ chim về và đánh giá tình trạng của mỗi nhà theo ngày, kèm báo cáo ngày, tuần, tháng.',
      'Bảo vệ tài khoản và truy vết thay đổi qua nhật ký.',
    ],
    paragraphs: [
      'Trạng thái sức khỏe theo ngày chỉ là chỉ báo dựa trên quy tắc minh bạch, không phải chẩn đoán.',
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
    // ALERT-FR-002, 013, REF-13
    title: '5. Dịch vụ bên ngoài',
    items: [
      'Firebase Cloud Messaging (Google): chuyển thông báo push đến app mobile.',
      'Telegram: gửi cảnh báo cho Chủ trại đã liên kết tài khoản.',
      'Open-Meteo: nhận tọa độ trang trại để trả về thời tiết; không nhận thông tin cá nhân.',
    ],
  },
  {
    // BR-36
    title: '6. Thời gian lưu trữ',
    items: [
      '90 ngày: số đo cảm biến, số đếm chim theo 5 phút, thời tiết theo giờ và thông báo trong app.',
      '180 ngày sau khi xử lý: cảnh báo.',
      'Suốt thời gian dùng hệ thống: số đếm theo phiên, trạng thái sức khỏe theo ngày và đánh giá, báo cáo, thu hoạch, lịch sử điều khiển tay, lịch sử thay đổi và nhật ký hệ thống.',
    ],
  },
  {
    // NFR-10, AUTH-FR-003, VISION-FR-013
    title: '7. Bảo mật',
    items: [
      'Mọi API không công khai đều yêu cầu token; phiên đăng nhập dùng token truy cập 15 phút và token làm mới 30 ngày.',
      'Đăng nhập sai quá 10 lần trong 15 phút từ một địa chỉ IP sẽ bị chặn tạm thời.',
      'Mỗi thiết bị có thông tin đăng nhập riêng và chỉ truy cập được kênh dữ liệu của chính nó.',
      'Luồng camera chỉ mở được bằng token xem 60 giây, cấp cho Chủ trại hoặc Chuyên gia của trang trại.',
    ],
  },
  {
    // AUTH-FR-009, 012, ALERT-FR-002, 013
    title: '8. Quyền của người dùng',
    items: [
      'Yêu cầu xóa tài khoản và dữ liệu cá nhân: Quản trị viên xử lý trong 30 ngày. Khi xóa, quyền sở hữu trang trại chuyển cho người đồng sở hữu sớm nhất (hoặc trang trại bị xóa mềm nếu không có), dữ liệu cá nhân được ẩn danh.',
      'Đặt lại mật khẩu bằng mã dùng một lần có hiệu lực 15 phút; sau khi đặt lại, mọi phiên cũ bị thu hồi.',
      'Hủy liên kết Telegram bất kỳ lúc nào; đăng xuất app mobile thì thiết bị không nhận push nữa.',
    ],
  },
  {
    title: '9. Liên hệ và thay đổi chính sách',
    paragraphs: [
      'Mọi câu hỏi hoặc yêu cầu về dữ liệu cá nhân xin gửi Quản trị viên của bản cài đặt.',
      'Khi chính sách thay đổi, phiên bản và ngày hiệu lực ở đầu trang được cập nhật.',
    ],
  },
];

export default function PrivacyPolicy(): JSX.Element {
  return (
    <>
      <h1 className="text-h1 text-charcoal">Chính sách quyền riêng tư</h1>
      <p className="mt-1 text-small text-warmGray">
        Phiên bản {POLICY_VERSION} · Hiệu lực từ {EFFECTIVE_DATE}
      </p>

      {SECTIONS.map(section => (
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

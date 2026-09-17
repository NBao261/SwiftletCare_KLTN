#include "WiFiProvisioner.h"
#include "config/Config.h"
#include "storage/StorageManager.h"
#include <DNSServer.h>
#include <WiFi.h>

namespace WiFiProvisioner {

static DNSServer dnsServer;
static bool portalActive = false;
static const byte DNS_PORT = 53;
static const IPAddress AP_IP(192, 168, 4, 1);

static String apSsid() { return "SwiftletCare-Setup-" + String(Config::deviceId); }

bool tryConnect() {
  // Ưu tiên WiFi đã lưu qua captive portal ở lần trước; nếu chưa từng cấu
  // hình thì dùng mặc định trong Secrets.h (giữ hành vi cũ cho thiết bị mới).
  String savedSsid, savedPass;
  if (StorageManager::loadWifiCredentials(savedSsid, savedPass)) {
    Config::wifiSsid = savedSsid;
    Config::wifiPassword = savedPass;
    Serial.println("[WiFi] Dùng WiFi đã lưu trong NVS: " + savedSsid);
  }

  Serial.print("[WiFi] Connecting to " + Config::wifiSsid);
  WiFi.mode(WIFI_STA);
  WiFi.begin(Config::wifiSsid.c_str(), Config::wifiPassword.c_str());

  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 20) {
    delay(500);
    Serial.print(".");
    retries++;
  }
  return WiFi.status() == WL_CONNECTED;
}

static const char *PORTAL_HTML = R"HTML(
<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SwiftletCare - Cau hinh WiFi</title>
<style>
  body{font-family:sans-serif;background:#27231F;color:#fff;display:flex;
       min-height:100vh;align-items:center;justify-content:center;margin:0}
  .card{background:#fff;color:#27231F;border-radius:20px;padding:28px 24px;
        width:90%;max-width:340px;box-shadow:0 8px 24px rgba(0,0,0,.2)}
  h1{font-size:18px;margin:0 0 4px}
  p{font-size:13px;color:#878380;margin:0 0 20px}
  label{font-size:12px;font-weight:600;color:#878380;text-transform:uppercase}
  input{width:100%;box-sizing:border-box;padding:10px 12px;margin:6px 0 16px;
        border:1px solid #87838040;border-radius:12px;font-size:14px}
  button{width:100%;padding:12px;border:none;border-radius:999px;
         background:#27231F;color:#fff;font-weight:700;font-size:15px}
</style></head><body>
<div class="card">
  <h1>Ket noi thiet bi voi WiFi</h1>
  <p>Thiet bi: %DEVICE_ID%</p>
  <form action="/save" method="POST">
    <label>Ten WiFi (SSID)</label>
    <input name="ssid" value="%WIFI_SSID%" %SSID_REQUIRED% autocomplete="off">
    <label>Mat khau</label>
    <input name="password" type="password" autocomplete="off">
    <label>Dia chi IP MQTT Broker (de trong neu khong doi)</label>
    <input name="mqttBroker" value="%MQTT_BROKER%" autocomplete="off">
    <button type="submit">Ket noi</button>
  </form>
</div>
</body></html>
)HTML";

static const char *SAVED_HTML = R"HTML(
<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Da luu</title>
<style>body{font-family:sans-serif;display:flex;min-height:100vh;
align-items:center;justify-content:center;text-align:center;padding:0 24px}</style>
</head><body><div>
<h2>Da luu cau hinh moi</h2>
<p>Thiet bi dang khoi dong lai va ket noi. Neu sai WiFi/MQTT broker, thiet bi
se tu phat lai mang cau hinh nay de ban nhap lai.</p>
</div></body></html>
)HTML";

void startCaptivePortal(AsyncWebServer &server) {
  portalActive = true;

  // Hàm này giờ có 2 điểm gọi (WiFiProvisioner.h): lúc WiFi chưa từng connect
  // được (tryConnect() thất bại — không có STA nào để giữ), và lúc WiFi vẫn
  // đang connected nhưng MQTT liên tục fail (MQTTManager::isBrokerUnreachable()
  // — chỉ IP broker sai, WiFi không sao). Giữ lại STA bằng WIFI_AP_STA trong
  // trường hợp thứ hai để mqttTask vẫn có thể tự reconnect (mDNS/IP mới) qua
  // WiFi trong lúc người dùng đang điền form; WIFI_AP thường (drop STA) chỉ
  // hợp lý khi thật sự không có STA nào để mất.
  WiFi.mode(WiFi.status() == WL_CONNECTED ? WIFI_AP_STA : WIFI_AP);

  // Thứ tự BẮT BUỘC: softAP() phải chạy trước softAPConfig(). Gọi ngược lại
  // (như bản đầu) khiến giao diện AP chưa thật sự khởi tạo lúc set IP, dẫn tới
  // DHCP server của AP không hoạt động đúng — điện thoại thấy tên mạng (vẫn
  // phát beacon) nhưng xin IP thất bại, báo "không thể kết nối" dù SSID hiện
  // rõ ràng. Đã verify lỗi này thật trên điện thoại trước khi sửa.
  WiFi.softAP(apSsid().c_str()); // không đặt mật khẩu — ai cũng vào được, không
                                 // cần biết trước gì (chủ đích, xem ghi chú header)
  delay(100); // để netif AP khởi tạo xong trước khi đổi IP
  WiFi.softAPConfig(AP_IP, AP_IP, IPAddress(255, 255, 255, 0));

  dnsServer.start(DNS_PORT, "*", AP_IP);

  Serial.println("[WiFi] Không kết nối được — bật AP-mode: " + apSsid());
  Serial.println("[WiFi] Kết nối điện thoại vào mạng trên, trình duyệt sẽ tự "
                 "mở trang cấu hình (hoặc vào http://192.168.4.1)");

  // `server` (otaServer dùng chung từ main.cpp) có thể đã có sẵn handler "/"
  // (trang OTA, đăng ký trong setup() lúc WiFi connect thành công) và route
  // của ElegantOTA (/update) — trường hợp này xảy ra đúng lúc portal được mở
  // do MQTT unreachable (WiFi vẫn ổn). ESPAsyncWebServer match route .on()
  // theo thứ tự đăng ký, nên không reset() thì handler "/" cũ (đăng ký trước)
  // luôn thắng và form cấu hình bên dưới không bao giờ tới được người dùng.
  // ESPAsyncWebServer không có API gỡ 1 route riêng lẻ, chỉ có reset() (xoá
  // toàn bộ handler) hoặc tạo AsyncWebServer mới — dùng reset() rồi đăng ký
  // lại từ đầu là cách đơn giản nhất. reset() chỉ xoá danh sách handler trong
  // bộ nhớ, không đụng tới socket đang lắng nghe, nên an toàn dù `server` đã
  // begin() hay chưa (đã verify trong source ESPAsyncWebServer/AsyncTCP).
  // Đánh đổi: OTA (/update) tạm thời không dùng được trong lúc portal đang mở
  // cho tới khi thiết bị restart — chấp nhận được vì đây là trạng thái bảo
  // trì tạm thời, không ảnh hưởng task sensor/relay/PID.
  server.reset();

  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request) {
    String html = String(PORTAL_HTML);
    html.replace("%DEVICE_ID%", Config::deviceId);
    html.replace("%MQTT_BROKER%", Config::mqttBroker);
    html.replace("%WIFI_SSID%", Config::wifiSsid);
    // SSID bắt buộc nhập chỉ khi portal mở do WiFi chưa từng connect được
    // (không có gì để "giữ nguyên" nếu để trống); optional khi WiFi vẫn
    // WL_CONNECTED (trường hợp isBrokerUnreachable(), chỉ IP broker sai) để
    // không bắt người dùng gõ lại đúng SSID/password hiện tại chỉ để sửa IP
    // broker. Logic tương tự áp dụng lại phía server trong /save bên dưới.
    html.replace("%SSID_REQUIRED%",
                 WiFi.status() == WL_CONNECTED ? "" : "required");
    request->send(200, "text/html", html);
  });

  server.on("/save", HTTP_POST, [](AsyncWebServerRequest *request) {
    String ssid = request->hasParam("ssid", true)
                      ? request->getParam("ssid", true)->value()
                      : "";
    ssid.trim();
    if (ssid.length() == 0 && WiFi.status() != WL_CONNECTED) {
      // Không có SSID nào để giữ nguyên (thiết bị chưa từng connect được) —
      // chặn ở đây để tránh trường hợp POST trực tiếp (bỏ qua thuộc tính
      // required phía client) khiến thiết bị restart vào trạng thái không
      // SSID nào cả.
      request->send(400, "text/plain",
                    "Thieu SSID (chua co WiFi nao dang ket noi de giu nguyen)");
      return;
    }
    if (ssid.length() > 0) {
      String password = request->hasParam("password", true)
                             ? request->getParam("password", true)->value()
                             : "";
      StorageManager::saveWifiCredentials(ssid, password);
    }
    // Nếu ssid rỗng (chỉ có thể xảy ra khi WiFi đang connected, theo guard ở
    // trên) — bỏ qua, không đụng tới WiFi credentials đã lưu.

    // MQTT broker: optional, để trống nghĩa là giữ nguyên giá trị cũ (không
    // ghi gì vào NVS, MQTTManager::begin() vẫn dùng giá trị đã lưu trước đó
    // hoặc mặc định Secrets.h nếu chưa từng đổi).
    if (request->hasParam("mqttBroker", true)) {
      String broker = request->getParam("mqttBroker", true)->value();
      broker.trim();
      if (broker.length() > 0) {
        StorageManager::saveMqttBroker(broker);
      }
    }

    request->send(200, "text/html", SAVED_HTML);
    // Delay nhỏ để response kịp gửi về trình duyệt trước khi mất kết nối AP
    delay(1500);
    ESP.restart();
  });

  // Các URL trình duyệt/hệ điều hành dùng để tự phát hiện captive portal
  // (Android/iOS/Windows) — trả về trang cấu hình thay vì 404 để tự bật popup.
  server.onNotFound([](AsyncWebServerRequest *request) {
    request->redirect("/");
  });

  server.begin();
}

void handleDnsLoop() {
  if (portalActive)
    dnsServer.processNextRequest();
}

bool isPortalActive() { return portalActive; }

} // namespace WiFiProvisioner

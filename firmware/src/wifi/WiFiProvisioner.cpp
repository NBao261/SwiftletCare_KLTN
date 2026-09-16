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
    <input name="ssid" required autocomplete="off">
    <label>Mat khau</label>
    <input name="password" type="password" autocomplete="off">
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
<h2>Da luu WiFi moi</h2>
<p>Thiet bi dang khoi dong lai va ket noi. Neu sai mat khau, thiet bi se tu
phat lai mang cau hinh nay sau ~10 giay de ban nhap lai.</p>
</div></body></html>
)HTML";

void startCaptivePortal(AsyncWebServer &server) {
  portalActive = true;

  // Thứ tự BẮT BUỘC: softAP() phải chạy trước softAPConfig(). Gọi ngược lại
  // (như bản đầu) khiến giao diện AP chưa thật sự khởi tạo lúc set IP, dẫn tới
  // DHCP server của AP không hoạt động đúng — điện thoại thấy tên mạng (vẫn
  // phát beacon) nhưng xin IP thất bại, báo "không thể kết nối" dù SSID hiện
  // rõ ràng. Đã verify lỗi này thật trên điện thoại trước khi sửa.
  WiFi.mode(WIFI_AP);
  WiFi.softAP(apSsid().c_str()); // không đặt mật khẩu — ai cũng vào được, không
                                 // cần biết trước gì (chủ đích, xem ghi chú header)
  delay(100); // để netif AP khởi tạo xong trước khi đổi IP
  WiFi.softAPConfig(AP_IP, AP_IP, IPAddress(255, 255, 255, 0));

  dnsServer.start(DNS_PORT, "*", AP_IP);

  Serial.println("[WiFi] Không kết nối được — bật AP-mode: " + apSsid());
  Serial.println("[WiFi] Kết nối điện thoại vào mạng trên, trình duyệt sẽ tự "
                 "mở trang cấu hình (hoặc vào http://192.168.4.1)");

  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request) {
    String html = String(PORTAL_HTML);
    html.replace("%DEVICE_ID%", Config::deviceId);
    request->send(200, "text/html", html);
  });

  server.on("/save", HTTP_POST, [](AsyncWebServerRequest *request) {
    if (!request->hasParam("ssid", true)) {
      request->send(400, "text/plain", "Thieu SSID");
      return;
    }
    String ssid = request->getParam("ssid", true)->value();
    String password = request->hasParam("password", true)
                           ? request->getParam("password", true)->value()
                           : "";
    StorageManager::saveWifiCredentials(ssid, password);
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

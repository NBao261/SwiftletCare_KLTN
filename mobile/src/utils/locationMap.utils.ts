import type { Coordinates } from '@/types'

// Bản đồ chọn toạ độ trang trại trên mobile: trang HTML nhỏ chạy Leaflet + ô bản đồ OpenStreetMap trong WebView, cùng nguồn và
// thông số với bản đồ của web (frontend/.../farms/FarmLocationMap.tsx, Report 4 §3.1)

// Chưa có vị trí: khung nhìn cả Việt Nam; có vị trí: đủ gần để thấy từng mái nhà — như web
export const VIETNAM_VIEW = { center: [16.0, 106.0] as const, zoom: 5 }
export const PIN_ZOOM = 17
// Toạ độ giữ 6 chữ số lẻ (khoảng 0,1 m), như khi lấy từ GPS
const COORDINATE_DECIMALS = 6
// Leaflet 1.9.4 tải từ unpkg kèm mã kiểm tra (SRI) của đúng tệp phát hành, trùng bản web đang dùng
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
const LEAFLET_CSS_INTEGRITY = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
const LEAFLET_JS_INTEGRITY = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='

// Tin bản đồ gửi về app: tâm bản đồ sau khi người dùng kéo hoặc phóng (vị trí dưới ghim), hoặc báo không tải được thư viện bản
// đồ (mất mạng)
export type LocationMapMessage = { kind: 'pick'; coordinates: Coordinates } | { kind: 'load-error' }

// Icon MapPin dạng đặc của Phosphor (bộ icon của app), khung 256; đầu nhọn ở đáy khung, giữa bề ngang
const MAP_PIN_PATH =
  'M128 16a88.1 88.1 0 0 0-88 88c0 75.3 80 132.17 83.41 134.55a8 8 0 0 0 9.18 0C136 236.17 216 179.3 216 104a88.1 88.1 0 0 0-88-88m0 56a32 32 0 1 1-32 32 32 32 0 0 1 32-32'
// Ghim cao 36 px, đủ thấy trên bản đồ mà không che nhiều mái nhà
const PIN_SIZE = 36

interface LocationMapHtmlOptions {
  // Vị trí lúc mở; null thì khung nhìn cả Việt Nam (xem trước thì không có ghim)
  coordinates: Coordinates | null
  // Kéo, phóng bản đồ được; false là ảnh xem trước
  isInteractive: boolean
  // Màu ghim và màu bóng mờ dưới ghim (token của theme, không thêm màu mới); ghim không có viền
  pinColor: string
  pinShadowColor: string
}

function roundCoordinate(value: number): number {
  const factor = 10 ** COORDINATE_DECIMALS
  return Math.round(value * factor) / factor
}

// Trang HTML của bản đồ. Ghim đứng yên ở giữa khung, người dùng kéo bản đồ để đưa đúng chỗ xuống dưới ghim; vị trí chọn là tâm
// bản đồ. window.setPin(lat, lng) để app đưa bản đồ tới một vị trí (GPS, gõ tay) — lần di chuyển đó không gửi lại về app
export function buildLocationMapHtml({ coordinates, isInteractive, pinColor, pinShadowColor }: LocationMapHtmlOptions): string {
  const initial = coordinates ? JSON.stringify([coordinates.lat, coordinates.lng]) : 'null'
  const interactive = isInteractive ? 'true' : 'false'
  // Xem trước mà chưa có toạ độ thì không có ghim (khung cả Việt Nam không phải vị trí đã chọn)
  const showPin = isInteractive || coordinates !== null
  return `<!doctype html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="${LEAFLET_CSS}" integrity="${LEAFLET_CSS_INTEGRITY}" crossorigin="" />
<style>
html,body,#map{margin:0;height:100%;width:100%}
#pin{position:absolute;left:50%;top:50%;width:${PIN_SIZE}px;height:${PIN_SIZE}px;transform:translate(-50%,-100%);z-index:1000;pointer-events:none;filter:drop-shadow(0 2px 3px ${pinShadowColor});display:${showPin ? 'block' : 'none'}}
</style>
</head><body><div id="map"></div>
<svg id="pin" viewBox="0 0 256 256" aria-hidden="true"><path d="${MAP_PIN_PATH}" fill="${pinColor}"/></svg>
<script>
function send(message){ if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(message)); }
function loadFailed(){ send({ kind: 'load-error' }); }
</script>
<script src="${LEAFLET_JS}" integrity="${LEAFLET_JS_INTEGRITY}" crossorigin="" onerror="loadFailed()"></script>
<script>
(function () {
  if (typeof L === 'undefined') { loadFailed(); return; }
  var interactive = ${interactive};
  var map = L.map('map', {
    zoomControl: interactive, dragging: interactive, touchZoom: interactive ? 'center' : false,
    doubleClickZoom: interactive ? 'center' : false, scrollWheelZoom: false, boxZoom: false, keyboard: false
  }).setView([${VIETNAM_VIEW.center[0]}, ${VIETNAM_VIEW.center[1]}], ${VIETNAM_VIEW.zoom});
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  // Lần di chuyển do app yêu cầu (setPin) không gửi về app, chỉ lần người dùng kéo hoặc phóng mới gửi tâm mới
  var isMovedByApp = false;
  window.setPin = function (lat, lng) {
    // Bản đồ xem trước mở lúc chưa có toạ độ thì ghim đang ẩn: có vị trí rồi thì hiện ghim
    document.getElementById('pin').style.display = 'block';
    var zoom = Math.max(map.getZoom(), ${PIN_ZOOM});
    // Đã đứng đúng chỗ thì Leaflet không báo moveend: không đặt cờ, kẻo lần kéo sau của người dùng bị bỏ qua
    if (map.getZoom() === zoom && map.getCenter().distanceTo([lat, lng]) < 0.05) return;
    isMovedByApp = true;
    map.setView([lat, lng], zoom, { animate: false });
  };
  map.on('moveend', function () {
    if (isMovedByApp) { isMovedByApp = false; return; }
    var center = map.getCenter();
    send({ kind: 'pick', lat: center.lat, lng: center.lng });
  });
  var initial = ${initial};
  if (initial) window.setPin(initial[0], initial[1]);
})();
</script>
</body></html>`
}

// Lệnh JavaScript đưa bản đồ đang mở tới một vị trí (ghim ở giữa nên ghim nằm đúng vị trí đó)
export function buildSetPinScript(coordinates: Coordinates): string {
  return `window.setPin && window.setPin(${coordinates.lat}, ${coordinates.lng}); true;`
}

// Đọc tin bản đồ gửi về; tin lạ hoặc toạ độ ngoài khoảng hợp lệ thì null
export function parseLocationMapMessage(data: string): LocationMapMessage | null {
  let message: unknown
  try {
    message = JSON.parse(data)
  } catch {
    return null
  }
  if (typeof message !== 'object' || message === null) return null
  const { kind, lat, lng } = message as { kind?: unknown; lat?: unknown; lng?: unknown }
  if (kind === 'load-error') return { kind: 'load-error' }
  if (kind !== 'pick' || typeof lat !== 'number' || typeof lng !== 'number') return null
  if (lat < -90 || lat > 90 || !Number.isFinite(lng)) return null
  // Bản đồ cho kéo vòng quanh trái đất: đưa kinh độ về -180…180
  const wrappedLng = ((((lng + 180) % 360) + 360) % 360) - 180
  return { kind: 'pick', coordinates: { lat: roundCoordinate(lat), lng: roundCoordinate(wrappedLng) } }
}

// Hai toạ độ trùng nhau (sau khi làm tròn 6 chữ số lẻ)
export function isSameCoordinates(left: Coordinates | null, right: Coordinates | null): boolean {
  if (!left || !right) return left === right
  return roundCoordinate(left.lat) === roundCoordinate(right.lat) && roundCoordinate(left.lng) === roundCoordinate(right.lng)
}

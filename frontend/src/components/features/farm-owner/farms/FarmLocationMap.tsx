import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import type { Coordinates } from '@/types';

interface FarmLocationMapProps {
  // Vị trí đang chọn; null thì chưa có ghim
  value: Coordinates | null;
  // Tăng lên khi khung bản đồ phải tới ghim (chọn gợi ý, GPS, gõ xong toạ độ); gõ từng phím thì không kéo khung
  focusRequest: number;
  onPick: (coordinates: Coordinates) => void;
}

// Chưa có vị trí: khung nhìn cả Việt Nam
const VIETNAM_VIEW: { center: L.LatLngTuple; zoom: number } = { center: [16.0, 106.0], zoom: 5 };
// Có vị trí: đủ gần để thấy từng mái nhà
const PIN_ZOOM = 17;

const PIN_ICON = L.divIcon({
  className: '',
  html: '<span class="block h-5 w-5 rounded-full border-[3px] border-white bg-charcoal shadow-lg"></span>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

// chọn vị trí farm trên bản đồ OpenStreetMap: bấm vào bản đồ hoặc kéo ghim
export default function FarmLocationMap({ value, focusRequest, onPick }: FarmLocationMapProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    if (!containerRef.current) return;
    const map = L.map(containerRef.current, { center: VIETNAM_VIEW.center, zoom: VIETNAM_VIEW.zoom });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    }).addTo(map);
    map.on('click', event => onPickRef.current({ lat: event.latlng.lat, lng: event.latlng.lng }));
    // Modal mở có hiệu ứng: khung đổi cỡ thì Leaflet tính lại, không thì ô bản đồ bị xám một phần
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(containerRef.current);
    mapRef.current = map;
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Ghim theo vị trí đang chọn; không đổi khung nhìn
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (markerRef.current) {
      markerRef.current.setLatLng([value.lat, value.lng]);
      return;
    }
    const marker = L.marker([value.lat, value.lng], { icon: PIN_ICON, draggable: true, keyboard: false }).addTo(map);
    marker.on('dragend', () => {
      const { lat, lng } = marker.getLatLng();
      onPickRef.current({ lat, lng });
    });
    markerRef.current = marker;
  }, [value]);

  // Đưa khung tới ghim lúc mở form (farm đã có vị trí) và mỗi lần được yêu cầu
  useEffect(() => {
    const map = mapRef.current;
    const current = valueRef.current;
    if (!map || !current) return;
    map.setView([current.lat, current.lng], Math.max(map.getZoom(), PIN_ZOOM));
  }, [focusRequest]);

  return <div ref={containerRef} className="h-64 w-full overflow-hidden rounded-xl border border-warmGray/20" />;
}

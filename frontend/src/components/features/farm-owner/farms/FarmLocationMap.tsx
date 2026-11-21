import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Coordinates } from '@/types'

interface FarmLocationMapProps {
  // Vị trí đang chọn; null thì bản đồ mở ở toàn Việt Nam, chưa có ghim
  value: Coordinates | null
  onPick: (coordinates: Coordinates) => void
}

// Chưa có vị trí: khung nhìn cả Việt Nam
const VIETNAM_VIEW: { center: L.LatLngTuple; zoom: number } = { center: [16.0, 106.0], zoom: 5 }
// Có vị trí: đủ gần để thấy từng mái nhà
const PIN_ZOOM = 17

const PIN_ICON = L.divIcon({
  className: '',
  html: '<span class="block h-5 w-5 rounded-full border-[3px] border-white bg-charcoal shadow-lg"></span>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

// FARM-FR-001 — chọn vị trí farm trên bản đồ OpenStreetMap: bấm vào bản đồ hoặc kéo ghim
export default function FarmLocationMap({ value, onPick }: FarmLocationMapProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick

  useEffect(() => {
    if (!containerRef.current) return
    const map = L.map(containerRef.current, { center: VIETNAM_VIEW.center, zoom: VIETNAM_VIEW.zoom })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    }).addTo(map)
    map.on('click', event => onPickRef.current({ lat: event.latlng.lat, lng: event.latlng.lng }))
    // Modal mở có hiệu ứng: khung đổi cỡ thì Leaflet tính lại, không thì ô bản đồ bị xám một phần
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(containerRef.current)
    mapRef.current = map
    return () => {
      observer.disconnect()
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  // Ghim theo vị trí đang chọn (bấm bản đồ, kéo ghim, GPS, tìm địa chỉ hoặc gõ tay)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!value) {
      markerRef.current?.remove()
      markerRef.current = null
      return
    }
    const position: L.LatLngTuple = [value.lat, value.lng]
    if (!markerRef.current) {
      const marker = L.marker(position, { icon: PIN_ICON, draggable: true, keyboard: false }).addTo(map)
      marker.on('dragend', () => {
        const { lat, lng } = marker.getLatLng()
        onPickRef.current({ lat, lng })
      })
      markerRef.current = marker
      map.setView(position, Math.max(map.getZoom(), PIN_ZOOM))
      return
    }
    markerRef.current.setLatLng(position)
    // Ghim ra ngoài khung nhìn (tìm địa chỉ, GPS, gõ tay): đưa khung tới và phóng gần
    if (!map.getBounds().contains(position)) map.setView(position, Math.max(map.getZoom(), PIN_ZOOM))
  }, [value])

  return <div ref={containerRef} className="h-64 w-full overflow-hidden rounded-xl border border-warmGray/20" />
}

import { useAllHouses } from '@/hooks/farm/useAllHouses'
import { useZonesOfHouses } from '@/hooks/farm/useZonesOfHouses'

// Tra tên tầng và nhà theo id từ danh sách nhà/tầng đã tải (dùng chung cache), cho các API chỉ trả id
export function useZoneDirectory() {
  const housesQuery = useAllHouses()
  const zonesQuery = useZonesOfHouses(housesQuery.houses.map(house => house._id))

  return {
    zoneById: new Map(zonesQuery.zones.map(zone => [zone._id, zone])),
    houseById: new Map(housesQuery.houses.map(house => [house._id, house])),
  }
}

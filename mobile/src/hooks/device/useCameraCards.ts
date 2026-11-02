import { useTodayBirdCounts } from '@/hooks/bird-count/useTodayBirdCounts'
import { useCameraNodes } from '@/hooks/device/useCameraNodes'
import { useZoneDirectory } from '@/hooks/farm/useZoneDirectory'
import type { BirdCountToday, CameraNode } from '@/types'

export interface CameraCardData {
  camera: CameraNode
  // Camera thuộc Nhà (Report 3 §2.8) — chỉ có tên nhà, không có tầng
  houseName: string
  // Số đếm hôm nay của cả nhà; chưa tải xong thì không có
  today?: BirdCountToday
}

// Camera AI của mọi nhà người dùng được xem, kèm tên nhà và số đếm hôm nay; camera online xếp trước
export function useCameraCards() {
  const cameraNodesQuery = useCameraNodes()
  const { houseById } = useZoneDirectory()
  const cameras = cameraNodesQuery.data?.data ?? []
  const houseIds = [...new Set(cameras.map(camera => camera.house_id))]
  const birdCountsQuery = useTodayBirdCounts(houseIds)
  const countByHouseId = new Map(birdCountsQuery.counts.map(day => [day.house_id, day]))

  const cards: CameraCardData[] = cameras
    .map(camera => ({
      camera,
      houseName: houseById.get(camera.house_id)?.name ?? '_',
      today: countByHouseId.get(camera.house_id),
    }))
    .sort((first, second) => Number(second.camera.status === 'ONLINE') - Number(first.camera.status === 'ONLINE'))

  return {
    cards,
    isLoading: cameraNodesQuery.isLoading,
    isError: cameraNodesQuery.isError,
  }
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { audioTrackApi } from '@/apis/shared/audioTracks.api'

/** useAudioTracks – danh mục file loa ru của 1 thiết bị (ENV-FR-013c) */
export function useAudioTracks(nodeId: string) {
  return useQuery({
    queryKey: ['audio-tracks', nodeId],
    queryFn: () => audioTrackApi.list(nodeId).then(r => r.data.data),
    // file_url ký tạm 1 giờ — lấy lại trước khi hết hạn nếu modal mở lâu
    staleTime: 30 * 60_000,
  })
}

/** Mutation thao tác trên danh mục, tự làm mới danh sách (và thiết bị khi đổi bài mặc định) */
function useTrackMutation<TVars>(nodeId: string, fn: (vars: TVars) => Promise<unknown>, refreshNodes = false) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['audio-tracks', nodeId] })
      if (refreshNodes) void queryClient.invalidateQueries({ queryKey: ['sensor-nodes'] })
    },
  })
}

export const useUploadAudioTrack = (nodeId: string) =>
  useTrackMutation(nodeId, (input: { file: File; track_number: number; display_name: string }) => audioTrackApi.upload(nodeId, input))

export const useSetAudioTrackSynced = (nodeId: string) =>
  useTrackMutation(nodeId, ({ trackId, synced }: { trackId: string; synced: boolean }) => audioTrackApi.setSyncStatus(nodeId, trackId, synced))

export const useDeleteAudioTrack = (nodeId: string) =>
  useTrackMutation(nodeId, (trackId: string) => audioTrackApi.remove(nodeId, trackId))

export const useSelectAudioTrack = (nodeId: string) =>
  useTrackMutation(nodeId, (trackId: string) => audioTrackApi.select(nodeId, trackId), true)

export function usePlayAudioTrack(nodeId: string) {
  return useMutation({ mutationFn: (trackId: string) => audioTrackApi.playNow(nodeId, trackId) })
}

export function useStopAudio(nodeId: string) {
  return useMutation({ mutationFn: () => audioTrackApi.stop(nodeId) })
}

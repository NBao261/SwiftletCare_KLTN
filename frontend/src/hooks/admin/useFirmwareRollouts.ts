import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { firmwareRolloutsApi } from '@/apis/admin/firmwareRollouts.api'
import type { FirmwareRollout, RolloutAction } from '@/types'

const KEY = ['admin-firmware-rollouts']
// Máy online lại hay xác nhận bản mới bất cứ lúc nào: làm mới khi còn đợt chưa xong
const REFRESH_MS = 10_000

export function useFirmwareRollouts() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<FirmwareRollout[]> => (await firmwareRolloutsApi.list()).data.data,
    refetchInterval: query => (query.state.data?.some(rollout => rollout.status === 'ACTIVE' || rollout.status === 'PAUSED') ? REFRESH_MS : false),
  })
}

function useRolloutMutation<TVars>(fn: (vars: TVars) => Promise<FirmwareRollout>) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => void queryClient.invalidateQueries({ queryKey: KEY }) })
}

export const useCreateFirmwareRollout = () =>
  useRolloutMutation((input: Parameters<typeof firmwareRolloutsApi.create>[0]) =>
    firmwareRolloutsApi.create(input).then(response => response.data.data))

export const useFirmwareRolloutAction = () =>
  useRolloutMutation(({ id, action }: { id: string; action: RolloutAction }) =>
    firmwareRolloutsApi.act(id, action).then(response => response.data.data))

export const useRetryRolloutTarget = () =>
  useRolloutMutation(({ id, nodeId }: { id: string; nodeId: string }) =>
    firmwareRolloutsApi.retry(id, nodeId).then(response => response.data.data))

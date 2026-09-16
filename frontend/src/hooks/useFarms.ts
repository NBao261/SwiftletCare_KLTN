import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { farmApi } from '@/services/api'
import type { Zone } from '@/types'

export function useFarms() {
  return useQuery({
    queryKey: ['farms'],
    queryFn: () => farmApi.list().then(r => r.data.data),
  })
}

export function useCreateFarm() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; address: string; region?: string }) => farmApi.create(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['farms'] }),
  })
}

export function useHouses(farmId: string | undefined) {
  return useQuery({
    queryKey: ['houses', farmId],
    queryFn: () => farmApi.listHouses(farmId!).then(r => r.data.data),
    enabled: !!farmId,
  })
}

export function useCreateHouse(farmId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; floors?: number }) => farmApi.createHouse(farmId, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['houses', farmId] }),
  })
}

export function useZones(houseId: string | undefined) {
  return useQuery({
    queryKey: ['zones', houseId],
    queryFn: () => farmApi.listZones(houseId!).then(r => r.data.data),
    enabled: !!houseId,
  })
}

export function useCreateZone(houseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; floor?: number }) => farmApi.createZone(houseId, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['zones', houseId] }),
  })
}

export function useUpdateThresholds(zoneId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (thresholds: Partial<Zone['thresholds']>) => farmApi.updateThresholds(zoneId, thresholds),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['zones'] }),
  })
}

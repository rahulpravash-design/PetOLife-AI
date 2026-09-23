import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { recordsService } from '@/services/records';
import type { HealthRecord } from '@/types';

export function useHealthRecords(petId: string) {
  return useQuery({
    queryKey: ['pets', petId, 'records'],
    queryFn: () => recordsService.list(petId),
    enabled: !!petId,
  });
}

export function useCreateHealthRecord(petId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<HealthRecord, 'id' | 'petId' | 'createdAt'>) =>
      recordsService.create(petId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pets', petId, 'records'] });
      queryClient.invalidateQueries({ queryKey: ['pets', petId, 'summary'] });
    },
  });
}

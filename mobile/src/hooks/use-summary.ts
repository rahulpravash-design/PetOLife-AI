import { useQuery } from '@tanstack/react-query';

import { aiService } from '@/services/ai';

export function useHealthSummary(petId: string, rangeStart?: string, rangeEnd?: string) {
  return useQuery({
    queryKey: ['pets', petId, 'summary', rangeStart, rangeEnd],
    queryFn: () => aiService.getSummary(petId, rangeStart, rangeEnd),
    enabled: !!petId,
  });
}

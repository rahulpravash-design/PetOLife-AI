import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { petsService } from '@/services/pets';
import type { Pet } from '@/types';

export function usePets() {
  return useQuery({ queryKey: ['pets'], queryFn: petsService.list });
}

export function usePet(id: string) {
  return useQuery({ queryKey: ['pets', id], queryFn: () => petsService.get(id), enabled: !!id });
}

export function useCreatePet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Pet, 'id' | 'createdAt'>) => petsService.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pets'] }),
  });
}

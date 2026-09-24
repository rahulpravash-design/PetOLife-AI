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

export function useDeletePet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => petsService.remove(id),
    onSuccess: (_data, id) => {
      // Drop everything cached under this pet (records, reminders, summary)
      // before refreshing the list so no screen briefly shows a deleted pet.
      queryClient.removeQueries({ queryKey: ['pets', id] });
      queryClient.invalidateQueries({ queryKey: ['pets'] });
    },
  });
}

import { api } from '@/services/api';
import type { Pet } from '@/types';

export const petsService = {
  list: () => api.get<Pet[]>('/api/pets'),
  get: (id: string) => api.get<Pet>(`/api/pets/${id}`),
  create: (data: Omit<Pet, 'id' | 'createdAt'>) => api.post<Pet>('/api/pets', data),
  update: (id: string, data: Partial<Omit<Pet, 'id' | 'createdAt'>>) =>
    api.patch<Pet>(`/api/pets/${id}`, data),
  remove: (id: string) => api.delete<void>(`/api/pets/${id}`),
};

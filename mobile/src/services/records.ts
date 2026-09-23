import { api } from '@/services/api';
import type { HealthRecord } from '@/types';

export const recordsService = {
  list: (petId: string) => api.get<HealthRecord[]>(`/api/pets/${petId}/records`),
  get: (petId: string, recordId: string) =>
    api.get<HealthRecord>(`/api/pets/${petId}/records/${recordId}`),
  create: (petId: string, data: Omit<HealthRecord, 'id' | 'petId' | 'createdAt'>) =>
    api.post<HealthRecord>(`/api/pets/${petId}/records`, data),
  update: (
    petId: string,
    recordId: string,
    data: Partial<Omit<HealthRecord, 'id' | 'petId' | 'createdAt'>>,
  ) => api.patch<HealthRecord>(`/api/pets/${petId}/records/${recordId}`, data),
  remove: (petId: string, recordId: string) =>
    api.delete<void>(`/api/pets/${petId}/records/${recordId}`),
};

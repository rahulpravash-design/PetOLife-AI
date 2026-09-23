import { NotFoundError } from '@/lib/api-utils';
import { petsRepo } from '@/lib/repositories/pets';
import { recordsRepo } from '@/lib/repositories/records';
import { remindersRepo } from '@/lib/repositories/reminders';

// Returns the pet only if owned by userId; otherwise 404s rather than 403s,
// so requests can't probe for the existence of pets they don't own.
export function requireOwnedPet(userId: string, petId: string) {
  const pet = petsRepo.findById(petId);
  if (!pet || pet.userId !== userId) {
    throw new NotFoundError('Pet not found');
  }
  return pet;
}

export function requireOwnedRecord(userId: string, petId: string, recordId: string) {
  requireOwnedPet(userId, petId);
  const record = recordsRepo.findById(recordId);
  if (!record || record.petId !== petId) {
    throw new NotFoundError('Record not found');
  }
  return record;
}

export function requireOwnedReminder(userId: string, petId: string, reminderId: string) {
  requireOwnedPet(userId, petId);
  const reminder = remindersRepo.findById(reminderId);
  if (!reminder || reminder.petId !== petId) {
    throw new NotFoundError('Reminder not found');
  }
  return reminder;
}

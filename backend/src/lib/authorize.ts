import { NotFoundError } from '@/lib/api-utils';
import { petsRepo } from '@/lib/repositories/pets';
import { recordsRepo } from '@/lib/repositories/records';
import { remindersRepo } from '@/lib/repositories/reminders';

// Returns the pet only if owned by userId; otherwise 404s rather than 403s,
// so requests can't probe for the existence of pets they don't own.
export async function requireOwnedPet(userId: string, petId: string) {
  const pet = await petsRepo.findById(petId);
  if (!pet || pet.userId !== userId) {
    throw new NotFoundError('Pet not found');
  }
  return pet;
}

export async function requireOwnedRecord(userId: string, petId: string, recordId: string) {
  await requireOwnedPet(userId, petId);
  const record = await recordsRepo.findById(recordId);
  if (!record || record.petId !== petId) {
    throw new NotFoundError('Record not found');
  }
  return record;
}

export async function requireOwnedReminder(userId: string, petId: string, reminderId: string) {
  await requireOwnedPet(userId, petId);
  const reminder = await remindersRepo.findById(reminderId);
  if (!reminder || reminder.petId !== petId) {
    throw new NotFoundError('Reminder not found');
  }
  return reminder;
}

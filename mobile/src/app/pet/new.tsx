import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useCreatePet } from '@/hooks/use-pets';
import type { Pet } from '@/types';

const SPECIES: Pet['species'][] = ['dog', 'cat', 'other'];

export default function NewPetScreen() {
  const createPet = useCreatePet();
  const [name, setName] = useState('');
  const [species, setSpecies] = useState<Pet['species']>('dog');
  const [breed, setBreed] = useState('');

  async function onSave() {
    const pet = await createPet.mutateAsync({ name: name.trim(), species, breed: breed.trim() || undefined });
    router.replace(`/pet/${pet.id}`);
  }

  return (
    <ScrollView style={styles.safe} contentContainerStyle={styles.content}>
      <Text style={styles.label}>Name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Bruno" />

      <Text style={styles.label}>Species</Text>
      <View style={styles.row}>
        {SPECIES.map((s) => (
          <Pressable
            key={s}
            style={[styles.chip, species === s && styles.chipActive]}
            onPress={() => setSpecies(s)}>
            <Text style={[styles.chipText, species === s && styles.chipTextActive]}>{s}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Breed (optional)</Text>
      <TextInput style={styles.input} value={breed} onChangeText={setBreed} placeholder="Golden Retriever" />

      <Pressable
        style={[styles.saveButton, (!name.trim() || createPet.isPending) && styles.saveButtonDisabled]}
        onPress={onSave}
        disabled={!name.trim() || createPet.isPending}>
        {createPet.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Add Pet</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: '#666', marginTop: 14, marginBottom: 6, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  row: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, backgroundColor: '#f0f0f0' },
  chipActive: { backgroundColor: '#208AEF' },
  chipText: { fontSize: 14, color: '#444', textTransform: 'capitalize' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  saveButton: { backgroundColor: '#208AEF', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 28 },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

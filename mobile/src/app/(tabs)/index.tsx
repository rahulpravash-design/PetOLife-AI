import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePets } from '@/hooks/use-pets';
import type { Pet } from '@/types';

function PetCard({ pet }: { pet: Pet }) {
  return (
    <Pressable style={styles.card} onPress={() => router.push(`/pet/${pet.id}`)}>
      <View style={styles.cardAvatar}>
        <Text style={styles.cardAvatarText}>{pet.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{pet.name}</Text>
        <Text style={styles.cardSubtitle}>{pet.breed ?? pet.species}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#999" />
    </Pressable>
  );
}

export default function HomeScreen() {
  const { data: pets, isLoading, isError, refetch, isRefetching } = usePets();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Your Pets</Text>
        <Pressable style={styles.addButton} onPress={() => router.push('/pet/new')}>
          <Ionicons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.center} />
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Couldn&apos;t load your pets. Pull to retry.</Text>
        </View>
      ) : !pets || pets.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No pets yet.</Text>
          <Link href="/pet/new" style={styles.emptyLink}>
            <Text style={styles.emptyLinkText}>Add your first pet</Text>
          </Link>
        </View>
      ) : (
        <FlatList
          data={pets}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => <PetCard pet={item} />}
          contentContainerStyle={styles.list}
          onRefresh={refetch}
          refreshing={isRefetching}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 28, fontWeight: '700' },
  addButton: {
    backgroundColor: '#208AEF',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { color: '#666', fontSize: 15 },
  emptyLink: { marginTop: 4 },
  emptyLinkText: { color: '#208AEF', fontSize: 15, fontWeight: '600' },
  list: { paddingHorizontal: 20, gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7f7f8',
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  cardAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardAvatarText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: '600' },
  cardSubtitle: { fontSize: 13, color: '#777', marginTop: 2, textTransform: 'capitalize' },
});

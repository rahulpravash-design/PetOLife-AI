import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuthStore } from '@/store/auth-store';

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>Profile</Text>
      <View style={styles.card}>
        <Text style={styles.name}>{user?.name ?? 'PetOLife user'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>
      <Pressable style={styles.signOutButton} onPress={() => signOut()}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 20 },
  title: { fontSize: 28, fontWeight: '700', paddingTop: 8, marginBottom: 20 },
  card: { backgroundColor: '#f7f7f8', borderRadius: 14, padding: 16, marginBottom: 24 },
  name: { fontSize: 18, fontWeight: '600' },
  email: { fontSize: 14, color: '#777', marginTop: 4 },
  signOutButton: {
    borderWidth: 1,
    borderColor: '#d33',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutText: { color: '#d33', fontSize: 16, fontWeight: '600' },
});

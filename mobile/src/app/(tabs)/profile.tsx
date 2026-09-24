import { useAuth, useUser } from '@clerk/expo';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { queryClient } from '@/services/query-client';

export default function ProfileScreen() {
  const { user } = useUser();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    // Ends the Clerk session (the source of truth for who is signed in) and
    // drops cached API data so the next person on this device never sees it.
    // The backend has nothing to revoke: Clerk session tokens expire on their own.
    try {
      await signOut();
    } finally {
      queryClient.clear();
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>Profile</Text>
      <View style={styles.card}>
        <Text style={styles.name}>{user?.fullName ?? 'PetOLife user'}</Text>
        <Text style={styles.email}>{user?.primaryEmailAddress?.emailAddress}</Text>
      </View>
      <Pressable style={styles.signOutButton} onPress={handleSignOut}>
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

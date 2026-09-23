import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { queryClient } from '@/services/query-client';
import { useAuthStore } from '@/store/auth-store';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const isAuthed = useAuthStore((s) => Boolean(s.token));
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (isHydrated) SplashScreen.hideAsync();
  }, [isHydrated]);

  if (!isHydrated) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={!isAuthed}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
          <Stack.Protected guard={isAuthed}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="pet/[id]/index" options={{ headerShown: true, title: 'Pet' }} />
            <Stack.Screen
              name="pet/[id]/add-record"
              options={{ headerShown: true, title: 'Add Record', presentation: 'modal' }}
            />
            <Stack.Screen
              name="pet/[id]/scan"
              options={{ headerShown: true, title: 'Scan Document', presentation: 'modal' }}
            />
            <Stack.Screen
              name="pet/[id]/add-reminder"
              options={{ headerShown: true, title: 'Add Reminder', presentation: 'modal' }}
            />
            <Stack.Screen
              name="pet/new"
              options={{ headerShown: true, title: 'Add Pet', presentation: 'modal' }}
            />
          </Stack.Protected>
        </Stack>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

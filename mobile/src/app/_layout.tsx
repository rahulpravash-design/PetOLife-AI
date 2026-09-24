import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { CLERK_PUBLISHABLE_KEY } from '@/constants/config';
import { queryClient } from '@/services/query-client';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  if (!CLERK_PUBLISHABLE_KEY) {
    throw new Error('Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY (see mobile/.env.example).');
  }

  // tokenCache persists Clerk's session credential in expo-secure-store
  // (iOS Keychain / Android Keystore) so the user stays signed in across launches.
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
      <RootNavigator />
    </ClerkProvider>
  );
}

function RootNavigator() {
  const colorScheme = useColorScheme();
  const { isLoaded, isSignedIn } = useAuth();
  const isAuthed = Boolean(isSignedIn);

  useEffect(() => {
    if (isLoaded) SplashScreen.hideAsync();
  }, [isLoaded]);

  if (!isLoaded) return null;

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

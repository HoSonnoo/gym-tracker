import { Colors } from '@/constants/Colors';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { RestTimerProvider } from '@/context/RestTimerContext';
import { UserPreferencesProvider } from '@/context/UserPreferencesContext';
import { initDatabase } from '@/database';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

// ─── Inner layout (ha accesso all'AuthContext) ────────────────────────────────

function AppNavigator() {
  const { user, loading, isGuest } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    const inAuthScreen = segments[0] === 'auth';
    const isAuthenticated = !!user || isGuest;

    if (!isAuthenticated && !inAuthScreen) {
      // Non autenticato → vai a login
      router.replace('/auth');
    } else if (isAuthenticated && inAuthScreen) {
      // Già autenticato ma su schermata auth → vai all'app
      router.replace('/(tabs)');
    }
  }, [user, isGuest, loading, segments]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.dark.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.dark.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="exercises" />
      <Stack.Screen name="template/[id]" />
      <Stack.Screen name="template/exercise/[id]" />
      <Stack.Screen
        name="template/exercise/set/[id]"
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="settings"
        options={{ presentation: 'modal', headerShown: false }}
      />
    </Stack>
  );
}

// ─── Root layout ──────────────────────────────────────────────────────────────

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    initDatabase()
      .catch((e) => console.error('Errore DB:', e))
      .finally(() => setDbReady(true));
  }, []);

  if (!dbReady) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.dark.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.dark.primary} />
      </View>
    );
  }

  return (
    <AuthProvider>
      <UserPreferencesProvider>
        <RestTimerProvider>
          <AppNavigator />
        </RestTimerProvider>
      </UserPreferencesProvider>
    </AuthProvider>
  );
}
import { ONBOARDING_KEY } from '@/app/onboarding';
import { Colors } from '@/constants/Colors';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { RestTimerProvider } from '@/context/RestTimerContext';
import { UserPreferencesProvider } from '@/context/UserPreferencesContext';
import { initDatabase } from '@/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

function AppNavigator() {
  const { user, loading, isGuest, justLoggedIn, clearJustLoggedIn } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  // Gestisce il redirect dopo un nuovo login (es. Google OAuth)
  useEffect(() => {
    if (!justLoggedIn || !user) return;
    clearJustLoggedIn();

    AsyncStorage.getItem(ONBOARDING_KEY).then((val) => {
      if (!val) {
        router.replace('/onboarding');
      } else {
        router.replace('/(tabs)');
      }
    });
  }, [justLoggedIn, user]);

  // Gestisce redirect auth/guest
  useEffect(() => {
    if (loading) return;

    const inAuthScreen = segments[0] === 'auth';
    const inOnboarding = segments[0] === 'onboarding';
    const isAuthenticated = !!user || isGuest;

    if (!isAuthenticated && !inAuthScreen) {
      router.replace('/auth');
      return;
    }

    if (isAuthenticated && inAuthScreen) {
      if (!isGuest && user) {
        AsyncStorage.getItem(ONBOARDING_KEY).then((val) => {
          if (!val) {
            router.replace('/onboarding');
          } else {
            router.replace('/(tabs)');
          }
        });
      } else {
        router.replace('/(tabs)');
      }
      return;
    }

    // Controlla onboarding al primo accesso
    if (isAuthenticated && !isGuest && user && !inOnboarding && !onboardingChecked) {
      setOnboardingChecked(true);
      AsyncStorage.getItem(ONBOARDING_KEY).then((val) => {
        if (!val) {
          router.replace('/onboarding');
        }
      });
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
      <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
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
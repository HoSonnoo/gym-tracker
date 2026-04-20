import { ONBOARDING_KEY } from '@/app/onboarding';
import { Colors } from '@/constants/Colors';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { RestTimerProvider } from '@/context/RestTimerContext';
import { SyncProvider } from '@/context/SyncContext';
import { UserPreferencesProvider } from '@/context/UserPreferencesContext';
import { initDatabase } from '@/database';
import { initHealthKit } from '@/lib/healthkit';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

function AppNavigator() {
  const { user, loading, isGuest, justLoggedIn, clearJustLoggedIn } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  // Gestisce il deep link di callback OAuth Google quando l'app si riapre
  useEffect(() => {
    const handleUrl = async (url: string) => {
      if (url && (url.includes('access_token') || url.includes('code='))) {
        try {
          await supabase.auth.exchangeCodeForSession(url);
        } catch {}
      }
    };

    // Controlla se l'app è stata aperta da un URL
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    // Ascolta futuri deep link
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

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
      <Stack.Screen name="log-historical" options={{ headerShown: false }} />
      <Stack.Screen name="template" options={{ headerShown: false }} />
      <Stack.Screen name="workout-session" options={{ headerShown: false }} />
      <Stack.Screen
        name="settings"
        options={{ presentation: 'modal', headerShown: false }}
      />
    </Stack>
  );
}

// Su web assicura il background corretto senza limitare la larghezza
// (la sidebar nel tabs layout gestisce lo spazio in autonomia).
function WebContainer({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={{ flex: 1, backgroundColor: Colors.dark.background }}>
      {children}
    </View>
  );
}

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    Promise.all([
      initDatabase().catch((e) => console.error('Errore DB:', e)),
      initHealthKit().catch(() => {}),
    ]).finally(() => setDbReady(true));
  }, []);

  if (!dbReady) {
    return (
      <WebContainer>
        <View style={{ flex: 1, backgroundColor: Colors.dark.background, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={Colors.dark.primary} />
        </View>
      </WebContainer>
    );
  }

  return (
    <WebContainer>
      <AuthProvider>
        <UserPreferencesProvider>
          <SyncProvider>
            <RestTimerProvider>
              <AppNavigator />
            </RestTimerProvider>
          </SyncProvider>
        </UserPreferencesProvider>
      </AuthProvider>
    </WebContainer>
  );
}
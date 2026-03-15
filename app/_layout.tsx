import { Colors } from '@/constants/Colors';
import { RestTimerProvider } from '@/context/RestTimerContext';
import { initDatabase, seedExercises } from '@/database';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function setupApp() {
      try {
        await initDatabase();
        await seedExercises();
      } catch (error) {
        console.error('Errore inizializzazione database:', error);
      } finally {
        setIsReady(true);
      }
    }
    setupApp();
  }, []);

  if (!isReady) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: Colors.dark.background,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" color={Colors.dark.primary} />
      </View>
    );
  }

  return (
    <RestTimerProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="exercises" />
        <Stack.Screen name="template/[id]" />
        <Stack.Screen name="template/exercise/[id]" />
        <Stack.Screen
          name="template/exercise/set/[id]"
          options={{ presentation: 'modal' }}
        />
      </Stack>
    </RestTimerProvider>
  );
}
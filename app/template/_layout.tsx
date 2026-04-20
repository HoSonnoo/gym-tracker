import { Stack } from 'expo-router';

export default function TemplateLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[id]" />
      <Stack.Screen name="exercise/[id]" />
      <Stack.Screen name="exercise/set/[id]" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

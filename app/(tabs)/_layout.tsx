import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { Text, TouchableOpacity } from 'react-native';

function SettingsButton() {
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => router.push('/settings')}
      style={{ marginRight: 16, padding: 4 }}
      activeOpacity={0.7}
    >
      <Ionicons name="settings-outline" size={22} color={Colors.dark.textMuted} />
    </TouchableOpacity>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerTitleAlign: 'center',
        headerStyle: { backgroundColor: Colors.dark.background },
        headerTitleStyle: { color: Colors.dark.text, fontWeight: '700' },
        headerShadowVisible: false,
        headerRight: () => <SettingsButton />,
        sceneStyle: { backgroundColor: Colors.dark.background },
        tabBarStyle: {
          backgroundColor: Colors.dark.surface,
          borderTopColor: Colors.dark.border,
          height: 68,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Colors.dark.tabIconSelected,
        tabBarInactiveTintColor: Colors.dark.tabIconDefault,
        tabBarLabel: ({ focused, color, children }) =>
          focused ? (
            <Text
              numberOfLines={1}
              style={{ fontSize: 10, fontWeight: '700', color, letterSpacing: -0.3 }}
            >
              {children}
            </Text>
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Oggi',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="today-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: 'Allenamenti',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="barbell-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          title: 'Alimentazione',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="nutrition-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendario',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progressi',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
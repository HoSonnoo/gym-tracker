import ChatBot from '@/components/ChatBot';
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
    <>
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
              style={{ fontSize: 10, fontWeight: '800', color, letterSpacing: -0.3 }}
            >
              {children}
            </Text>
          ) : null,
      }}
    >
      <Tabs.Screen
        name="workouts"
        options={{
          title: '',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'barbell' : 'barbell-outline'} size={focused ? size + 4 : size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: '',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={focused ? size + 4 : size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: '',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={focused ? size + 4 : size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          title: '',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'nutrition' : 'nutrition-outline'} size={focused ? size + 4 : size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: '',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'stats-chart' : 'stats-chart-outline'} size={focused ? size + 4 : size} color={color} />
          ),
        }}
      />
    </Tabs>
      <ChatBot />
    </>
  );
}
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { Slot, usePathname, useRouter } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';
import ChatBot from '@/components/ChatBot';

const NAV_ITEMS = [
  {
    name: 'index',
    href: '/',
    label: 'Home',
    icon: 'home-outline' as const,
    iconActive: 'home' as const,
  },
  {
    name: 'workouts',
    href: '/workouts',
    label: 'Allenamenti',
    icon: 'barbell-outline' as const,
    iconActive: 'barbell' as const,
  },
  {
    name: 'calendar',
    href: '/calendar',
    label: 'Calendario',
    icon: 'calendar-outline' as const,
    iconActive: 'calendar' as const,
  },
  {
    name: 'nutrition',
    href: '/nutrition',
    label: 'Nutrizione',
    icon: 'nutrition-outline' as const,
    iconActive: 'nutrition' as const,
  },
  {
    name: 'progress',
    href: '/progress',
    label: 'Progressi',
    icon: 'stats-chart-outline' as const,
    iconActive: 'stats-chart' as const,
  },
];

function isActive(pathname: string, name: string): boolean {
  if (name === 'index') return pathname === '/' || pathname === '/index';
  return pathname === `/${name}` || pathname.startsWith(`/${name}/`);
}

function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <View
      style={{
        width: 220,
        backgroundColor: Colors.dark.surface,
        borderRightWidth: 1,
        borderRightColor: Colors.dark.border,
        paddingTop: 28,
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 36 }}>
        <Text
          style={{
            color: Colors.dark.primary,
            fontSize: 26,
            fontWeight: '800',
            letterSpacing: -1,
          }}
        >
          Vyro
        </Text>
        <Text style={{ color: Colors.dark.textMuted, fontSize: 11, marginTop: 2 }}>
          Fitness Tracker
        </Text>
      </View>

      {/* Nav items */}
      <View style={{ flex: 1, gap: 2, paddingHorizontal: 10 }}>
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.name);
          return (
            <TouchableOpacity
              key={item.name}
              onPress={() => router.push(item.href as any)}
              activeOpacity={0.75}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 14,
                paddingVertical: 11,
                borderRadius: 10,
                backgroundColor: active
                  ? Colors.dark.primary + '22'
                  : 'transparent',
              }}
            >
              <Ionicons
                name={active ? item.iconActive : item.icon}
                size={20}
                color={active ? Colors.dark.primary : Colors.dark.textMuted}
              />
              <Text
                style={{
                  marginLeft: 12,
                  fontSize: 14,
                  fontWeight: active ? '700' : '500',
                  color: active ? Colors.dark.text : Colors.dark.textMuted,
                }}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Settings + divider in basso */}
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: Colors.dark.border,
          paddingHorizontal: 10,
          paddingVertical: 12,
        }}
      >
        <TouchableOpacity
          onPress={() => router.push('/settings')}
          activeOpacity={0.75}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 14,
            paddingVertical: 11,
            borderRadius: 10,
          }}
        >
          <Ionicons
            name="settings-outline"
            size={20}
            color={Colors.dark.textMuted}
          />
          <Text
            style={{
              marginLeft: 12,
              fontSize: 14,
              fontWeight: '500',
              color: Colors.dark.textMuted,
            }}
          >
            Impostazioni
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function WebTabsLayout() {
  return (
    <View
      style={{ flex: 1, flexDirection: 'row', backgroundColor: Colors.dark.background }}
    >
      <Sidebar />
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <Slot />
      </View>
      <ChatBot />
    </View>
  );
}

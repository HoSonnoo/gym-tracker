import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { Text, TouchableOpacity, View } from 'react-native';

export const WEB_SIDEBAR_WIDTH = 240;

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
  // Evidenzia "Allenamenti" anche sulle pagine /template/*
  if (name === 'workouts') return pathname === '/workouts' || pathname.startsWith('/template');
  return pathname === `/${name}` || pathname.startsWith(`/${name}/`);
}

export default function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <View
      style={{
        width: WEB_SIDEBAR_WIDTH,
        backgroundColor: Colors.dark.surface,
        borderRightWidth: 1,
        borderRightColor: Colors.dark.border,
        flexShrink: 0,
      }}
    >
      {/* Accent line in cima */}
      <View style={{ height: 3, backgroundColor: Colors.dark.primary }} />

      {/* Logo — tap riporta alla Home */}
      <TouchableOpacity
        onPress={() => router.push('/')}
        activeOpacity={0.75}
        style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 24 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              backgroundColor: Colors.dark.primary + '22',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: Colors.dark.primary, fontSize: 18, fontWeight: '800' }}>V</Text>
          </View>
          <View>
            <Text style={{ color: Colors.dark.text, fontSize: 17, fontWeight: '800', letterSpacing: -0.5 }}>
              Vyro
            </Text>
            <Text style={{ color: Colors.dark.textMuted, fontSize: 10, marginTop: 1 }}>
              Fitness Tracker
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Divider */}
      <View style={{ height: 1, backgroundColor: Colors.dark.border, marginHorizontal: 16, marginBottom: 10 }} />

      {/* Nav items */}
      <View style={{ flex: 1, gap: 2, paddingHorizontal: 10, paddingTop: 6 }}>
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
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: active ? Colors.dark.primary + '18' : 'transparent',
              }}
            >
              {active && (
                <View
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 8,
                    bottom: 8,
                    width: 3,
                    backgroundColor: Colors.dark.primary,
                    borderRadius: 2,
                  }}
                />
              )}
              <Ionicons
                name={active ? item.iconActive : item.icon}
                size={19}
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

      {/* Settings in basso */}
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
            paddingVertical: 12,
            borderRadius: 12,
          }}
        >
          <Ionicons name="settings-outline" size={19} color={Colors.dark.textMuted} />
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
